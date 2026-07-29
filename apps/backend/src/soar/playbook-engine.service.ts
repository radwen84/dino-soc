import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { IocService } from '../ioc/ioc.service';
import { AssetsService } from '../assets/assets.service';
import { ThreatIntelService } from '../threat-intel/threat-intel.service';

interface PlaybookAction {
  type:
    | 'enrich_alert'
    | 'lookup_ioc'
    | 'isolate_host'
    | 'block_ip'
    | 'create_incident'
    | 'notify'
    | 'escalate'
    | 'tag_asset';
  params: Record<string, any>;
}

interface PlaybookCondition {
  field: string;
  operator: 'eq' | 'gt' | 'lt' | 'contains' | 'in' | 'regex';
  value: any;
}

@Injectable()
export class PlaybookEngine {
  private readonly logger = new Logger(PlaybookEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly iocService: IocService,
    private readonly assetsService: AssetsService,
    private readonly threatIntel: ThreatIntelService,
  ) {}

  @OnEvent('alert:new')
  async onNewAlert(alert: any) {
    await this.evaluatePlaybooks('alert', alert);
  }

  @OnEvent('incident.created')
  async onIncidentCreated(incident: any) {
    await this.evaluatePlaybooks('incident', incident);
  }

  async evaluatePlaybooks(triggerType: string, data: any) {
    const playbooks = await this.prisma.playbook.findMany({
      where: { isActive: true },
    });

    for (const playbook of playbooks) {
      const conditions = playbook.triggerConditions as any;
      if (conditions.triggerType !== triggerType) continue;

      if (this.matchConditions(conditions.rules || [], data)) {
        this.logger.log(`Playbook triggered: ${playbook.name}`);
        await this.executePlaybook(playbook, data);
      }
    }
  }

  private matchConditions(conditions: PlaybookCondition[], data: any): boolean {
    return conditions.every((condition) => {
      const value = this.getNestedValue(data, condition.field);
      switch (condition.operator) {
        case 'eq':
          return value === condition.value;
        case 'gt':
          return value > condition.value;
        case 'lt':
          return value < condition.value;
        case 'contains':
          return String(value).includes(condition.value);
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(value);
        case 'regex':
          return new RegExp(condition.value).test(String(value));
        default:
          return false;
      }
    });
  }

  private async executePlaybook(playbook: any, triggerData: any) {
    const actions = playbook.actions as PlaybookAction[];
    const context: Record<string, any> = { trigger: triggerData, results: {} };

    for (const action of actions) {
      try {
        const result = await this.executeAction(action, context);
        context.results[action.type] = result;
      } catch (error) {
        this.logger.error(
          `Playbook ${playbook.name} action ${action.type} failed: ${error.message}`,
        );
        break; // Stop on failure
      }
    }

    // Update execution count
    await this.prisma.playbook.update({
      where: { id: playbook.id },
      data: {
        executionCount: { increment: 1 },
        lastTriggered: new Date(),
      },
    });
  }

  private async executeAction(action: PlaybookAction, context: any): Promise<any> {
    switch (action.type) {
      case 'enrich_alert':
        return this.threatIntel.enrichAlert(context.trigger);

      case 'lookup_ioc':
        const value = this.resolveParam(action.params.value, context);
        return this.threatIntel.lookup(value);

      case 'block_ip':
        const ip = this.resolveParam(action.params.ip, context);
        this.logger.warn(`[SOAR] Blocking IP: ${ip}`);
        // Integration with firewall API would go here
        return { blocked: ip, timestamp: new Date() };

      case 'isolate_host':
        const hostname = this.resolveParam(action.params.hostname, context);
        this.logger.warn(`[SOAR] Isolating host: ${hostname}`);
        // Integration with EDR/Wazuh active response
        return { isolated: hostname, timestamp: new Date() };

      case 'create_incident':
        this.eventEmitter.emit('soar.create_incident', {
          title: this.resolveParam(action.params.title, context),
          severity: action.params.severity || 'high',
          source: 'soar_playbook',
        });
        return { created: true };

      case 'notify':
        this.eventEmitter.emit('notification.send', {
          channel: action.params.channel || 'websocket',
          message: this.resolveParam(action.params.message, context),
          severity: action.params.severity,
        });
        return { notified: true };

      case 'escalate':
        this.logger.warn(`[SOAR] Escalating to: ${action.params.team}`);
        return { escalated: action.params.team };

      default:
        this.logger.warn(`Unknown action type: ${action.type}`);
        return null;
    }
  }

  private resolveParam(param: string, context: any): string {
    // Replace {{trigger.field}} with actual values
    return param.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
      return this.getNestedValue(context, path) || '';
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }
}
