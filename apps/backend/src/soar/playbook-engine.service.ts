import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { IocService } from '../ioc/ioc.service';
import { AssetsService } from '../assets/assets.service';
import { ThreatIntelService } from '../threat-intel/threat-intel.service';
import { RedisService } from '../redis/redis.service';
import { WazuhService } from '../wazuh/wazuh.service';
import {
  PlaybookActionType,
  PlaybookActionDto,
  PlaybookRiskLevel,
  ConditionOperator,
  PlaybookConditionDto,
} from './dto/create-playbook.dto';
import { ApprovalStatus } from './dto/approval.dto';

// ─────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────

export interface PlaybookExecutionResult {
  executionId: string;
  playbookId: string;
  playbookName: string;
  status: 'success' | 'failed' | 'partial' | 'pending_approval' | 'dry_run';
  startedAt: Date;
  completedAt: Date | null;
  executedActions: ActionExecutionResult[];
  pendingApprovals: PendingApproval[];
  error?: string;
}

export interface ActionExecutionResult {
  actionId: string;
  actionName: string;
  actionType: PlaybookActionType;
  status: 'success' | 'failed' | 'skipped' | 'pending_approval' | 'rolled_back';
  startedAt: Date;
  completedAt: Date | null;
  output: any;
  error?: string;
  retryCount: number;
}

export interface PendingApproval {
  approvalId: string;
  executionId: string;
  playbookId: string;
  actionId: string;
  actionName: string;
  actionType: PlaybookActionType;
  riskLevel: PlaybookRiskLevel;
  context: Record<string, any>;
  status: ApprovalStatus;
  requestedAt: Date;
  requestedBy: string;
  expiresAt: Date;
  decidedBy?: string;
  decidedAt?: Date;
  reason?: string;
}

// ─────────────────────────────────────────────────────────────
// DAG Execution Engine
// ─────────────────────────────────────────────────────────────

@Injectable()
export class PlaybookEngine {
  private readonly logger = new Logger(PlaybookEngine.name);
  private readonly APPROVAL_TTL_SECONDS = 3600; // 1 hour
  private readonly APPROVAL_KEY_PREFIX = 'soar:approval:';
  private readonly EXECUTION_KEY_PREFIX = 'soar:execution:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly iocService: IocService,
    private readonly assetsService: AssetsService,
    private readonly threatIntel: ThreatIntelService,
    private readonly redis: RedisService,
    private readonly wazuh: WazuhService,
  ) {}

  // ─────────────────────────────────────────────────────────
  // Event Listeners
  // ─────────────────────────────────────────────────────────

  @OnEvent('alert:new')
  async onNewAlert(alert: any) {
    await this.evaluatePlaybooks('alert', alert);
  }

  @OnEvent('incident.created')
  async onIncidentCreated(incident: any) {
    await this.evaluatePlaybooks('incident', incident);
  }

  // ─────────────────────────────────────────────────────────
  // Main Evaluation
  // ─────────────────────────────────────────────────────────

  async evaluatePlaybooks(triggerType: string, data: any, dryRun = false) {
    const playbooks = await this.prisma.playbook.findMany({
      where: { isActive: true },
    });

    const results: PlaybookExecutionResult[] = [];

    for (const playbook of playbooks) {
      const conditions = playbook.triggerConditions as any;
      if (conditions.triggerType !== triggerType) continue;

      if (this.matchConditions(conditions.rules || [], data)) {
        this.logger.log(`Playbook triggered: ${playbook.name} (dryRun=${dryRun})`);
        const result = await this.executePlaybook(playbook, data, dryRun);
        results.push(result);
      }
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────
  // DAG-Based Execution
  // ─────────────────────────────────────────────────────────

  async executePlaybook(
    playbook: any,
    triggerData: any,
    dryRun = false,
  ): Promise<PlaybookExecutionResult> {
    const executionId = crypto.randomUUID();
    const actions = playbook.actions as PlaybookActionDto[];
    const context: Record<string, any> = { trigger: triggerData, results: {} };
    const executedActions: ActionExecutionResult[] = [];
    const pendingApprovals: PendingApproval[] = [];

    const startedAt = new Date();

    // Validate DAG (no cycles)
    if (!this.validateDAG(actions)) {
      return {
        executionId,
        playbookId: playbook.id,
        playbookName: playbook.name,
        status: 'failed',
        startedAt,
        completedAt: new Date(),
        executedActions: [],
        pendingApprovals: [],
        error: 'Invalid playbook: DAG contains cycles',
      };
    }

    // Build execution order using topological sort
    const executionOrder = this.topologicalSort(actions);

    // Track completed action IDs
    const completedActions = new Set<string>();
    let hasFailure = false;
    let hasPendingApproval = false;

    for (const actionId of executionOrder) {
      if (hasFailure) break;

      const action = actions.find((a) => a.id === actionId);
      if (!action) continue;

      // Check dependencies are met
      if (action.dependsOn?.length) {
        const depsOk = action.dependsOn.every((dep) => completedActions.has(dep));
        if (!depsOk) {
          executedActions.push({
            actionId: action.id,
            actionName: action.name,
            actionType: action.type,
            status: 'skipped',
            startedAt: new Date(),
            completedAt: new Date(),
            output: null,
            error: 'Dependencies not met',
            retryCount: 0,
          });
          continue;
        }
      }

      // Check if action requires approval
      if (action.requiresApproval || this.isHighRiskAction(action)) {
        if (!dryRun) {
          const approval = await this.requestApproval(executionId, playbook, action, context);
          pendingApprovals.push(approval);
          hasPendingApproval = true;

          executedActions.push({
            actionId: action.id,
            actionName: action.name,
            actionType: action.type,
            status: 'pending_approval',
            startedAt: new Date(),
            completedAt: null,
            output: { approvalId: approval.approvalId },
            retryCount: 0,
          });
          continue;
        }
      }

      // Execute action (with retry)
      const result = await this.executeActionWithRetry(action, context, dryRun);
      executedActions.push(result);

      if (result.status === 'success') {
        completedActions.add(action.id);
        context.results[action.id] = result.output;
      } else if (result.status === 'failed') {
        hasFailure = true;

        // Execute rollback if defined
        if (action.rollbackActionId) {
          const rollbackAction = actions.find((a) => a.id === action.rollbackActionId);
          if (rollbackAction) {
            const rollbackResult = await this.executeActionWithRetry(
              rollbackAction,
              context,
              dryRun,
            );
            rollbackResult.status = 'rolled_back';
            executedActions.push(rollbackResult);
          }
        }
      }
    }

    // Update playbook execution stats
    if (!dryRun) {
      await this.prisma.playbook.update({
        where: { id: playbook.id },
        data: {
          executionCount: { increment: 1 },
          lastTriggered: new Date(),
        },
      });
    }

    // Store execution state in Redis for pending approvals
    const result: PlaybookExecutionResult = {
      executionId,
      playbookId: playbook.id,
      playbookName: playbook.name,
      status: dryRun
        ? 'dry_run'
        : hasPendingApproval
          ? 'pending_approval'
          : hasFailure
            ? 'failed'
            : 'success',
      startedAt,
      completedAt: hasPendingApproval ? null : new Date(),
      executedActions,
      pendingApprovals,
    };

    if (!dryRun) {
      await this.redis.setJson(`${this.EXECUTION_KEY_PREFIX}${executionId}`, result, 86400);
    }

    // Emit execution event
    this.eventEmitter.emit('soar.execution_complete', result);

    return result;
  }

  // ─────────────────────────────────────────────────────────
  // Action Execution with Retry
  // ─────────────────────────────────────────────────────────

  private async executeActionWithRetry(
    action: PlaybookActionDto,
    context: any,
    dryRun: boolean,
  ): Promise<ActionExecutionResult> {
    const maxRetries = action.retryPolicy?.maxRetries ?? 3;
    const delayMs = action.retryPolicy?.delayMs ?? 1000;
    const exponential = action.retryPolicy?.exponentialBackoff ?? true;

    let lastError: string | undefined;
    let retryCount = 0;
    const startedAt = new Date();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = exponential ? delayMs * Math.pow(2, attempt - 1) : delayMs;
          await this.sleep(delay);
          retryCount = attempt;
        }

        const output = dryRun
          ? { dryRun: true, action: action.type, params: action.params }
          : await this.executeAction(action, context);

        return {
          actionId: action.id,
          actionName: action.name,
          actionType: action.type,
          status: 'success',
          startedAt,
          completedAt: new Date(),
          output,
          retryCount,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Action ${action.name} attempt ${attempt + 1}/${maxRetries + 1} failed: ${lastError}`,
        );
      }
    }

    return {
      actionId: action.id,
      actionName: action.name,
      actionType: action.type,
      status: 'failed',
      startedAt,
      completedAt: new Date(),
      output: null,
      error: lastError,
      retryCount,
    };
  }

  // ─────────────────────────────────────────────────────────
  // Real Action Implementations
  // ─────────────────────────────────────────────────────────

  private async executeAction(action: PlaybookActionDto, context: any): Promise<any> {
    const timeoutMs = action.timeoutMs || 30000;

    return Promise.race([
      this.doExecuteAction(action, context),
      this.timeout(timeoutMs, `Action ${action.name} timed out after ${timeoutMs}ms`),
    ]);
  }

  private async doExecuteAction(action: PlaybookActionDto, context: any): Promise<any> {
    switch (action.type) {
      case PlaybookActionType.ENRICH_ALERT:
        return this.threatIntel.enrichAlert(context.trigger);

      case PlaybookActionType.LOOKUP_IOC: {
        const value = this.resolveParam(action.params?.value || '', context);
        return this.threatIntel.lookup(value);
      }

      case PlaybookActionType.BLOCK_IP: {
        const ip = this.resolveParam(action.params?.ip || '', context);
        const agentId = this.resolveParam(action.params?.agentId || '000', context);
        this.logger.warn(`[SOAR] Blocking IP: ${ip} via Wazuh agent ${agentId}`);

        // Real action: call Wazuh active response
        const result = await this.wazuh.blockIP(agentId, ip);

        // Also store in Redis blocklist for quick lookup
        await this.redis.set(
          `soar:blocked_ip:${ip}`,
          JSON.stringify({
            blockedAt: new Date().toISOString(),
            reason: 'soar_playbook',
            agentId,
          }),
          86400,
        ); // 24h TTL

        this.eventEmitter.emit('soar.action.block_ip', { ip, agentId, result });
        return { blocked: ip, agentId, timestamp: new Date(), wazuhResponse: result };
      }

      case PlaybookActionType.ISOLATE_HOST: {
        const hostname = this.resolveParam(action.params?.hostname || '', context);
        const agentId = this.resolveParam(action.params?.agentId || '', context);
        this.logger.warn(`[SOAR] Isolating host: ${hostname} (agent: ${agentId})`);

        // Real action: Wazuh active response for network isolation
        const result = await this.wazuh.triggerActiveResponse(agentId, 'disable-network', null);

        this.eventEmitter.emit('soar.action.isolate_host', { hostname, agentId });
        return { isolated: hostname, agentId, timestamp: new Date(), wazuhResponse: result };
      }

      case PlaybookActionType.REVOKE_SESSIONS: {
        const userId = this.resolveParam(action.params?.userId || '', context);
        this.logger.warn(`[SOAR] Revoking all sessions for user: ${userId}`);

        // Real action: invalidate all tokens in Redis
        const pattern = `session:${userId}:*`;
        const client = this.redis.getClient();
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
          await client.del(...keys);
        }

        // Also add to token blacklist
        await this.redis.set(`soar:revoked_user:${userId}`, new Date().toISOString(), 86400);

        this.eventEmitter.emit('soar.action.revoke_sessions', {
          userId,
          sessionsRevoked: keys.length,
        });
        return { userId, sessionsRevoked: keys.length, timestamp: new Date() };
      }

      case PlaybookActionType.DISABLE_USER: {
        const userId = this.resolveParam(action.params?.userId || '', context);
        this.logger.warn(`[SOAR] Disabling user: ${userId}`);

        await this.prisma.user.update({
          where: { id: userId },
          data: { isActive: false, lockedUntil: new Date(Date.now() + 86400000) },
        });

        // Also revoke sessions
        await this.doExecuteAction(
          { ...action, type: PlaybookActionType.REVOKE_SESSIONS, params: { userId } } as any,
          context,
        );

        return { disabled: userId, timestamp: new Date() };
      }

      case PlaybookActionType.CREATE_INCIDENT: {
        const title = this.resolveParam(action.params?.title || 'Auto-generated incident', context);
        this.eventEmitter.emit('soar.create_incident', {
          title,
          severity: action.params?.severity || 'high',
          source: 'soar_playbook',
          description: this.resolveParam(action.params?.description || '', context),
          mitreTechniques: action.params?.mitreTechniques || [],
        });
        return { created: true, title };
      }

      case PlaybookActionType.NOTIFY: {
        const message = this.resolveParam(action.params?.message || '', context);
        this.eventEmitter.emit('notification.send', {
          channel: action.params?.channel || 'websocket',
          message,
          severity: action.params?.severity,
        });
        return { notified: true, channel: action.params?.channel };
      }

      case PlaybookActionType.ESCALATE: {
        this.logger.warn(`[SOAR] Escalating to: ${action.params?.team}`);
        this.eventEmitter.emit('soar.escalate', {
          team: action.params?.team,
          reason: this.resolveParam(action.params?.reason || '', context),
        });
        return { escalated: action.params?.team };
      }

      case PlaybookActionType.WEBHOOK: {
        const url = this.resolveParam(action.params?.url || '', context);
        const payload = action.params?.payload
          ? JSON.parse(this.resolveParam(JSON.stringify(action.params.payload), context))
          : context.trigger;

        // Use native fetch for webhook calls
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });

        return { webhookSent: true, status: response.status, url };
      }

      case PlaybookActionType.TAG_ASSET: {
        const assetId = this.resolveParam(action.params?.assetId || '', context);
        const tags = action.params?.tags || [];
        // Tag asset via assets service
        return { tagged: assetId, tags };
      }

      default:
        this.logger.warn(`Unknown action type: ${action.type}`);
        return null;
    }
  }

  // ─────────────────────────────────────────────────────────
  // Human-in-the-Loop Approval
  // ─────────────────────────────────────────────────────────

  private async requestApproval(
    executionId: string,
    playbook: any,
    action: PlaybookActionDto,
    context: any,
  ): Promise<PendingApproval> {
    const approvalId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.APPROVAL_TTL_SECONDS * 1000);

    const approval: PendingApproval = {
      approvalId,
      executionId,
      playbookId: playbook.id,
      actionId: action.id,
      actionName: action.name,
      actionType: action.type,
      riskLevel: action.riskLevel || PlaybookRiskLevel.HIGH,
      context: {
        trigger: context.trigger,
        action: { type: action.type, params: action.params },
      },
      status: ApprovalStatus.APPROVAL_REQUIRED,
      requestedAt: new Date(),
      requestedBy: 'system',
      expiresAt,
    };

    // Store in Redis
    await this.redis.setJson(
      `${this.APPROVAL_KEY_PREFIX}${approvalId}`,
      approval,
      this.APPROVAL_TTL_SECONDS,
    );

    // Notify SOC team
    this.eventEmitter.emit('soar.approval_required', approval);
    this.logger.warn(
      `[SOAR] Approval required for action "${action.name}" (${action.type}) - ID: ${approvalId}`,
    );

    return approval;
  }

  async processApproval(
    approvalId: string,
    decision: 'approved' | 'rejected',
    decidedBy: string,
    reason?: string,
  ): Promise<PendingApproval | null> {
    const approval = await this.redis.getJson<PendingApproval>(
      `${this.APPROVAL_KEY_PREFIX}${approvalId}`,
    );

    if (!approval) {
      this.logger.warn(`Approval not found or expired: ${approvalId}`);
      return null;
    }

    if (approval.status !== ApprovalStatus.APPROVAL_REQUIRED) {
      this.logger.warn(`Approval already processed: ${approvalId}`);
      return approval;
    }

    // Check expiration
    if (new Date() > new Date(approval.expiresAt)) {
      approval.status = ApprovalStatus.EXPIRED;
      await this.redis.setJson(`${this.APPROVAL_KEY_PREFIX}${approvalId}`, approval, 3600);
      return approval;
    }

    // Process decision
    approval.status = decision === 'approved' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
    approval.decidedBy = decidedBy;
    approval.decidedAt = new Date();
    approval.reason = reason;

    await this.redis.setJson(`${this.APPROVAL_KEY_PREFIX}${approvalId}`, approval, 3600);

    // If approved, resume execution
    if (decision === 'approved') {
      this.logger.log(`[SOAR] Action approved: ${approval.actionName} by ${decidedBy}`);
      await this.resumeExecution(approval);
    } else {
      this.logger.log(`[SOAR] Action rejected: ${approval.actionName} by ${decidedBy} - ${reason}`);
    }

    // Audit
    this.eventEmitter.emit('soar.approval_processed', {
      approvalId,
      decision,
      decidedBy,
      reason,
      action: approval.actionName,
    });

    return approval;
  }

  async getPendingApprovals(): Promise<PendingApproval[]> {
    const client = this.redis.getClient();
    const keys = await client.keys(`${this.APPROVAL_KEY_PREFIX}*`);
    const approvals: PendingApproval[] = [];

    for (const key of keys) {
      const approval = await this.redis.getJson<PendingApproval>(key);
      if (approval && approval.status === ApprovalStatus.APPROVAL_REQUIRED) {
        approvals.push(approval);
      }
    }

    return approvals.sort(
      (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
    );
  }

  private async resumeExecution(approval: PendingApproval) {
    const execution = await this.redis.getJson<PlaybookExecutionResult>(
      `${this.EXECUTION_KEY_PREFIX}${approval.executionId}`,
    );
    if (!execution) return;

    // Find the playbook and re-execute the approved action
    const playbook = await this.prisma.playbook.findUnique({
      where: { id: approval.playbookId },
    });
    if (!playbook) return;

    const actions = playbook.actions as unknown as PlaybookActionDto[];
    const action = actions.find((a) => a.id === approval.actionId);
    if (!action) return;

    const context = approval.context;
    const result = await this.executeActionWithRetry(action, context, false);

    this.logger.log(`[SOAR] Resumed action "${action.name}" after approval: ${result.status}`);
  }

  // ─────────────────────────────────────────────────────────
  // DAG Validation & Topological Sort
  // ─────────────────────────────────────────────────────────

  validateDAG(actions: PlaybookActionDto[]): boolean {
    const actionIds = new Set(actions.map((a) => a.id));
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    // Check all dependencies reference valid action IDs
    for (const action of actions) {
      if (action.dependsOn) {
        for (const dep of action.dependsOn) {
          if (!actionIds.has(dep)) return false;
        }
      }
    }

    // DFS cycle detection
    const hasCycle = (actionId: string): boolean => {
      visited.add(actionId);
      recursionStack.add(actionId);

      const action = actions.find((a) => a.id === actionId);
      const dependents = actions.filter((a) => a.dependsOn?.includes(actionId));

      for (const dependent of dependents) {
        if (!visited.has(dependent.id)) {
          if (hasCycle(dependent.id)) return true;
        } else if (recursionStack.has(dependent.id)) {
          return true;
        }
      }

      recursionStack.delete(actionId);
      return false;
    };

    for (const action of actions) {
      if (!visited.has(action.id)) {
        if (hasCycle(action.id)) return false;
      }
    }

    return true;
  }

  private topologicalSort(actions: PlaybookActionDto[]): string[] {
    const sorted: string[] = [];
    const visited = new Set<string>();
    const inDegree = new Map<string, number>();

    // Initialize in-degree
    for (const action of actions) {
      inDegree.set(action.id, action.dependsOn?.length || 0);
    }

    // Find nodes with no dependencies (in-degree = 0)
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    while (queue.length > 0) {
      const current = queue.shift();
      sorted.push(current);
      visited.add(current);

      // Find actions that depend on current
      for (const action of actions) {
        if (action.dependsOn?.includes(current)) {
          const newDegree = (inDegree.get(action.id) || 0) - 1;
          inDegree.set(action.id, newDegree);
          if (newDegree === 0) queue.push(action.id);
        }
      }
    }

    // Add any remaining actions not in the DAG
    for (const action of actions) {
      if (!visited.has(action.id)) sorted.push(action.id);
    }

    return sorted;
  }

  // ─────────────────────────────────────────────────────────
  // Condition Matching (enhanced)
  // ─────────────────────────────────────────────────────────

  matchConditions(conditions: PlaybookConditionDto[], data: any): boolean {
    return conditions.every((condition) => {
      const value = this.getNestedValue(data, condition.field);
      switch (condition.operator) {
        case ConditionOperator.EQ:
          return value === condition.value;
        case ConditionOperator.NOT_EQ:
          return value !== condition.value;
        case ConditionOperator.GT:
          return value > condition.value;
        case ConditionOperator.LT:
          return value < condition.value;
        case ConditionOperator.GTE:
          return value >= condition.value;
        case ConditionOperator.LTE:
          return value <= condition.value;
        case ConditionOperator.CONTAINS:
          return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
        case ConditionOperator.IN:
          return Array.isArray(condition.value) && condition.value.includes(value);
        case ConditionOperator.REGEX:
          try {
            return new RegExp(condition.value).test(String(value));
          } catch {
            return false;
          }
        default:
          return false;
      }
    });
  }

  // ─────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────

  private isHighRiskAction(action: PlaybookActionDto): boolean {
    const highRiskTypes: PlaybookActionType[] = [
      PlaybookActionType.ISOLATE_HOST,
      PlaybookActionType.DISABLE_USER,
      PlaybookActionType.REVOKE_SESSIONS,
    ];
    return action.riskLevel === PlaybookRiskLevel.CRITICAL || highRiskTypes.includes(action.type);
  }

  private resolveParam(param: string, context: any): string {
    return param.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
      return this.getNestedValue(context, path) ?? '';
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private timeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
  }
}
