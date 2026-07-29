import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PlaybookEngine } from './playbook-engine.service';

@Injectable()
export class SoarService {
  private readonly logger = new Logger(SoarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly playbookEngine: PlaybookEngine,
  ) {}

  async getPlaybooks() {
    return this.prisma.playbook.findMany({
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });
  }

  async getPlaybook(id: string) {
    const playbook = await this.prisma.playbook.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    if (!playbook) throw new NotFoundException(`Playbook not found: ${id}`);
    return playbook;
  }

  async createPlaybook(data: any, userId: string) {
    const playbook = await this.prisma.playbook.create({
      data: {
        name: data.name,
        description: data.description,
        triggerConditions: data.triggerConditions,
        actions: data.actions,
        isActive: data.isActive ?? true,
        createdById: userId,
      },
    });

    await this.auditService.log('PLAYBOOK_CREATED', {
      userId,
      resourceType: 'playbook',
      resourceId: playbook.id,
    });

    return playbook;
  }

  async togglePlaybook(id: string, userId: string) {
    const playbook = await this.getPlaybook(id);
    const updated = await this.prisma.playbook.update({
      where: { id },
      data: { isActive: !playbook.isActive },
    });

    await this.auditService.log('PLAYBOOK_TOGGLED', {
      userId,
      resourceType: 'playbook',
      resourceId: id,
      details: { isActive: updated.isActive },
    });

    return updated;
  }

  async executeManually(id: string, testData: any, userId: string) {
    const playbook = await this.getPlaybook(id);
    this.logger.log(`Manual execution of playbook: ${playbook.name}`);

    await this.playbookEngine.evaluatePlaybooks(
      (playbook.triggerConditions as any).triggerType,
      testData,
    );

    await this.auditService.log('PLAYBOOK_MANUAL_EXEC', {
      userId,
      resourceType: 'playbook',
      resourceId: id,
    });

    return { executed: true, playbookName: playbook.name };
  }

  async getDefaultPlaybooks() {
    return [
      {
        name: 'Auto-enrich critical alerts',
        description: 'Automatically enrich alerts with level >= 12 using threat intel',
        triggerConditions: {
          triggerType: 'alert',
          rules: [{ field: 'level', operator: 'gt', value: 11 }],
        },
        actions: [
          { type: 'enrich_alert', params: {} },
          {
            type: 'notify',
            params: {
              channel: 'websocket',
              message: 'Critical alert enriched: {{trigger.ruleDescription}}',
              severity: 'critical',
            },
          },
        ],
      },
      {
        name: 'Block known malicious IP',
        description: 'Block source IP when IOC match with confidence > 80',
        triggerConditions: {
          triggerType: 'alert',
          rules: [{ field: 'level', operator: 'gt', value: 7 }],
        },
        actions: [
          { type: 'lookup_ioc', params: { value: '{{trigger.srcIp}}' } },
          { type: 'block_ip', params: { ip: '{{trigger.srcIp}}' } },
          {
            type: 'create_incident',
            params: { title: 'Malicious IP blocked: {{trigger.srcIp}}', severity: 'high' },
          },
        ],
      },
      {
        name: 'Escalate critical incidents',
        description: 'Auto-escalate critical incidents to L3 analysts',
        triggerConditions: {
          triggerType: 'incident',
          rules: [{ field: 'severity', operator: 'eq', value: 'critical' }],
        },
        actions: [
          { type: 'escalate', params: { team: 'analyst_l3' } },
          {
            type: 'notify',
            params: {
              channel: 'websocket',
              message: 'Critical incident escalated: {{trigger.title}}',
              severity: 'critical',
            },
          },
        ],
      },
    ];
  }
}
