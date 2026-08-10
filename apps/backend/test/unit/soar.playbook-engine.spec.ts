import { Test, TestingModule } from '@nestjs/testing';
import { PlaybookEngine } from '../../src/soar/playbook-engine.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IocService } from '../../src/ioc/ioc.service';
import { AssetsService } from '../../src/assets/assets.service';
import { ThreatIntelService } from '../../src/threat-intel/threat-intel.service';
import { RedisService } from '../../src/redis/redis.service';
import { WazuhService } from '../../src/wazuh/wazuh.service';
import { PlaybookActionType, PlaybookActionDto, PlaybookRiskLevel, ConditionOperator } from '../../src/soar/dto/create-playbook.dto';

describe('PlaybookEngine', () => {
  let engine: PlaybookEngine;
  let mockPrisma: any;
  let mockRedis: any;
  let mockWazuh: any;
  let mockEventEmitter: any;
  let mockThreatIntel: any;

  beforeEach(async () => {
    mockPrisma = {
      playbook: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: { update: jest.fn() },
    };

    mockRedis = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      setJson: jest.fn(),
      getJson: jest.fn(),
      getClient: jest.fn().mockReturnValue({ keys: jest.fn().mockResolvedValue([]), del: jest.fn() }),
    };

    mockWazuh = {
      blockIP: jest.fn().mockResolvedValue({ success: true }),
      triggerActiveResponse: jest.fn().mockResolvedValue({ success: true }),
    };

    mockEventEmitter = { emit: jest.fn() };
    mockThreatIntel = {
      enrichAlert: jest.fn().mockResolvedValue({ srcIp: { riskLevel: 'high' } }),
      lookup: jest.fn().mockResolvedValue({ knownIoc: true, riskLevel: 'high' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaybookEngine,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: IocService, useValue: { matchValue: jest.fn() } },
        { provide: AssetsService, useValue: {} },
        { provide: ThreatIntelService, useValue: mockThreatIntel },
        { provide: RedisService, useValue: mockRedis },
        { provide: WazuhService, useValue: mockWazuh },
      ],
    }).compile();

    engine = module.get<PlaybookEngine>(PlaybookEngine);
  });

  // ─────────────────────────────────────────────────────────
  // DAG Validation
  // ─────────────────────────────────────────────────────────

  describe('validateDAG', () => {
    it('should validate a simple linear DAG', () => {
      const actions: PlaybookActionDto[] = [
        { id: 'a1', name: 'Step 1', type: PlaybookActionType.LOOKUP_IOC },
        { id: 'a2', name: 'Step 2', type: PlaybookActionType.BLOCK_IP, dependsOn: ['a1'] },
        { id: 'a3', name: 'Step 3', type: PlaybookActionType.NOTIFY, dependsOn: ['a2'] },
      ];

      expect(engine.validateDAG(actions)).toBe(true);
    });

    it('should validate a DAG with parallel branches', () => {
      const actions: PlaybookActionDto[] = [
        { id: 'a1', name: 'Start', type: PlaybookActionType.LOOKUP_IOC },
        { id: 'a2', name: 'Branch A', type: PlaybookActionType.BLOCK_IP, dependsOn: ['a1'] },
        { id: 'a3', name: 'Branch B', type: PlaybookActionType.NOTIFY, dependsOn: ['a1'] },
        { id: 'a4', name: 'Join', type: PlaybookActionType.CREATE_INCIDENT, dependsOn: ['a2', 'a3'] },
      ];

      expect(engine.validateDAG(actions)).toBe(true);
    });

    it('should reject a graph with invalid dependency references', () => {
      const actions: PlaybookActionDto[] = [
        { id: 'a1', name: 'Step 1', type: PlaybookActionType.LOOKUP_IOC },
        { id: 'a2', name: 'Step 2', type: PlaybookActionType.BLOCK_IP, dependsOn: ['nonexistent'] },
      ];

      expect(engine.validateDAG(actions)).toBe(false);
    });

    it('should accept actions with no dependencies', () => {
      const actions: PlaybookActionDto[] = [
        { id: 'a1', name: 'Step 1', type: PlaybookActionType.LOOKUP_IOC },
        { id: 'a2', name: 'Step 2', type: PlaybookActionType.NOTIFY },
      ];

      expect(engine.validateDAG(actions)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // Condition Matching
  // ─────────────────────────────────────────────────────────

  describe('matchConditions', () => {
    it('should match EQ condition', () => {
      const conditions = [{ field: 'severity', operator: ConditionOperator.EQ, value: 'critical' }];
      expect(engine.matchConditions(conditions, { severity: 'critical' })).toBe(true);
      expect(engine.matchConditions(conditions, { severity: 'low' })).toBe(false);
    });

    it('should match GT condition', () => {
      const conditions = [{ field: 'level', operator: ConditionOperator.GT, value: 10 }];
      expect(engine.matchConditions(conditions, { level: 12 })).toBe(true);
      expect(engine.matchConditions(conditions, { level: 5 })).toBe(false);
    });

    it('should match CONTAINS condition (case insensitive)', () => {
      const conditions = [{ field: 'description', operator: ConditionOperator.CONTAINS, value: 'malware' }];
      expect(engine.matchConditions(conditions, { description: 'Detected MALWARE activity' })).toBe(true);
      expect(engine.matchConditions(conditions, { description: 'Normal traffic' })).toBe(false);
    });

    it('should match nested fields with dot notation', () => {
      const conditions = [{ field: 'data.srcIp', operator: ConditionOperator.EQ, value: '10.0.0.1' }];
      expect(engine.matchConditions(conditions, { data: { srcIp: '10.0.0.1' } })).toBe(true);
    });

    it('should require ALL conditions to match', () => {
      const conditions = [
        { field: 'level', operator: ConditionOperator.GT, value: 10 },
        { field: 'severity', operator: ConditionOperator.EQ, value: 'critical' },
      ];
      expect(engine.matchConditions(conditions, { level: 12, severity: 'critical' })).toBe(true);
      expect(engine.matchConditions(conditions, { level: 12, severity: 'low' })).toBe(false);
    });

    it('should match REGEX condition', () => {
      const conditions = [{ field: 'srcIp', operator: ConditionOperator.REGEX, value: '^10\\.0\\.' }];
      expect(engine.matchConditions(conditions, { srcIp: '10.0.1.5' })).toBe(true);
      expect(engine.matchConditions(conditions, { srcIp: '192.168.1.1' })).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // Playbook Execution
  // ─────────────────────────────────────────────────────────

  describe('executePlaybook', () => {
    const mockPlaybook = {
      id: 'pb-uuid',
      name: 'Test Playbook',
      triggerConditions: { triggerType: 'alert', rules: [] },
      actions: [
        { id: 'a1', name: 'Enrich', type: PlaybookActionType.ENRICH_ALERT, params: {} },
        { id: 'a2', name: 'Notify', type: PlaybookActionType.NOTIFY, params: { message: 'Alert enriched', channel: 'websocket' } },
      ],
      isActive: true,
    };

    it('should execute playbook actions sequentially', async () => {
      mockPrisma.playbook.update.mockResolvedValue({});

      const result = await engine.executePlaybook(mockPlaybook, { srcIp: '1.2.3.4' }, false);

      expect(result.status).toBe('success');
      expect(result.executedActions).toHaveLength(2);
      expect(result.executedActions[0].status).toBe('success');
      expect(result.executedActions[1].status).toBe('success');
    });

    it('should execute in dry-run mode without side effects', async () => {
      const result = await engine.executePlaybook(mockPlaybook, { srcIp: '1.2.3.4' }, true);

      expect(result.status).toBe('dry_run');
      expect(result.executedActions[0].output.dryRun).toBe(true);
      expect(mockWazuh.blockIP).not.toHaveBeenCalled();
      expect(mockPrisma.playbook.update).not.toHaveBeenCalled();
    });

    it('should call Wazuh for block_ip action', async () => {
      const playbookWithBlock = {
        ...mockPlaybook,
        actions: [
          { id: 'a1', name: 'Block', type: PlaybookActionType.BLOCK_IP, params: { ip: '1.2.3.4', agentId: '001' } },
        ],
      };
      mockPrisma.playbook.update.mockResolvedValue({});

      const result = await engine.executePlaybook(playbookWithBlock, {}, false);

      expect(result.status).toBe('success');
      expect(mockWazuh.blockIP).toHaveBeenCalledWith('001', '1.2.3.4');
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should request approval for high-risk actions', async () => {
      const playbookWithApproval = {
        ...mockPlaybook,
        actions: [
          {
            id: 'a1',
            name: 'Isolate Host',
            type: PlaybookActionType.ISOLATE_HOST,
            params: { hostname: 'srv01', agentId: '002' },
            riskLevel: PlaybookRiskLevel.CRITICAL,
          },
        ],
      };
      mockPrisma.playbook.update.mockResolvedValue({});

      const result = await engine.executePlaybook(playbookWithApproval, {}, false);

      expect(result.status).toBe('pending_approval');
      expect(result.pendingApprovals).toHaveLength(1);
      expect(mockRedis.setJson).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('soar.approval_required', expect.any(Object));
    });

    it('should stop execution on action failure', async () => {
      mockThreatIntel.enrichAlert.mockRejectedValue(new Error('Service unavailable'));

      const playbookFail = {
        ...mockPlaybook,
        actions: [
          { id: 'a1', name: 'Enrich', type: PlaybookActionType.ENRICH_ALERT, params: {}, retryPolicy: { maxRetries: 0 } },
          { id: 'a2', name: 'Notify', type: PlaybookActionType.NOTIFY, params: { message: 'test' } },
        ],
      };
      mockPrisma.playbook.update.mockResolvedValue({});

      const result = await engine.executePlaybook(playbookFail, { srcIp: '1.2.3.4' }, false);

      expect(result.status).toBe('failed');
      expect(result.executedActions[0].status).toBe('failed');
      // Second action should not execute after failure
      expect(result.executedActions.length).toBeLessThanOrEqual(2);
    });
  });

  // ─────────────────────────────────────────────────────────
  // Approval Workflow
  // ─────────────────────────────────────────────────────────

  describe('processApproval', () => {
    it('should approve and resume execution', async () => {
      const mockApproval = {
        approvalId: 'approval-uuid',
        executionId: 'exec-uuid',
        playbookId: 'pb-uuid',
        actionId: 'a1',
        actionName: 'Isolate Host',
        actionType: PlaybookActionType.ISOLATE_HOST,
        riskLevel: PlaybookRiskLevel.CRITICAL,
        context: { trigger: { hostname: 'srv01' } },
        status: 'approval_required',
        requestedAt: new Date(),
        requestedBy: 'system',
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockRedis.getJson.mockResolvedValue(mockApproval);
      mockPrisma.playbook.findUnique.mockResolvedValue({
        id: 'pb-uuid',
        actions: [{ id: 'a1', name: 'Isolate', type: PlaybookActionType.ISOLATE_HOST, params: { hostname: 'srv01', agentId: '002' } }],
      });

      const result = await engine.processApproval('approval-uuid', 'approved', 'admin-user', 'Confirmed threat');

      expect(result.status).toBe('approved');
      expect(result.decidedBy).toBe('admin-user');
      expect(mockRedis.setJson).toHaveBeenCalled();
    });

    it('should reject and not execute', async () => {
      const mockApproval = {
        approvalId: 'approval-uuid',
        status: 'approval_required',
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockRedis.getJson.mockResolvedValue(mockApproval);

      const result = await engine.processApproval('approval-uuid', 'rejected', 'admin-user', 'False positive');

      expect(result.status).toBe('rejected');
      expect(mockWazuh.triggerActiveResponse).not.toHaveBeenCalled();
    });

    it('should return null for expired approvals', async () => {
      mockRedis.getJson.mockResolvedValue(null);

      const result = await engine.processApproval('nonexistent', 'approved', 'admin', null);

      expect(result).toBeNull();
    });
  });
});
