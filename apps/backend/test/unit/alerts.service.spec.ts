import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { AlertsService } from './alerts.service';
import { PrismaService } from '../prisma/prisma.service';
import { OpenSearchService } from '../opensearch/opensearch.service';

describe('AlertsService', () => {
  let service: AlertsService;
  let prisma: jest.Mocked<PrismaService>;
  let opensearch: jest.Mocked<OpenSearchService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockPrismaService = {
      alert: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      incident: {
        create: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    const mockOpenSearchService = {
      search: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OpenSearchService, useValue: mockOpenSearchService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
    prisma = module.get(PrismaService);
    opensearch = module.get(OpenSearchService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('syncFromOpenSearch', () => {
    it('should handle zero hits gracefully', async () => {
      (prisma.alert.findFirst as jest.Mock).mockResolvedValue(null);
      (opensearch.search as jest.Mock).mockResolvedValue({ hits: { hits: [] } });

      const res = await service.syncFromOpenSearch();
      expect(res).toEqual({ synced: 0, errors: 0 });
    });

    it('should sync raw OpenSearch docs and parsed JSON string message format', async () => {
      (prisma.alert.findFirst as jest.Mock).mockResolvedValue({
        timestamp: new Date('2026-09-01'),
      });

      const hits = [
        // Format A: Direct document
        {
          _id: 'wazuh-1',
          _source: {
            timestamp: '2026-09-10T00:00:00Z',
            rule: { id: 101, description: 'Test Rule', level: 10, mitre: { tactic: ['initial-access'], id: ['T1190'] } },
            agent: { id: '001', name: 'agent-1' },
            data: { srcip: '1.2.3.4', dstip: '5.6.7.8', srcport: 80, dstport: 443 },
          },
        },
        // Format B: Filebeat wrapped message string
        {
          _id: 'wazuh-2',
          _source: {
            '@timestamp': '2026-09-10T01:00:00Z',
            message: JSON.stringify({
              rule: { id: 102, description: 'Filebeat Rule', level: 3, mitre: { tactic: 'execution', id: 'T1059' } },
              agent: { name: 'agent-2' },
            }),
          },
        },
      ];

      (opensearch.search as jest.Mock).mockResolvedValue({ hits: { hits } });
      (prisma.alert.upsert as jest.Mock).mockImplementation(({ create }) =>
        Promise.resolve({ ...create, id: 'db-id', createdAt: new Date() }),
      );

      const res = await service.syncFromOpenSearch();

      expect(res.synced).toBe(2);
      expect(eventEmitter.emit).toHaveBeenCalledWith('alert.new', expect.anything());
    });

    it('should log warning and increment error when message JSON parsing fails', async () => {
      (prisma.alert.findFirst as jest.Mock).mockResolvedValue(null);
      (opensearch.search as jest.Mock).mockResolvedValue({
        hits: {
          hits: [{ _id: 'bad-doc', _source: { message: 'invalid-json{' } }],
        },
      });

      const res = await service.syncFromOpenSearch();
      expect(res.errors).toBe(1);
    });

    it('should ignore duplicate Prisma P2002 errors silently', async () => {
      (prisma.alert.findFirst as jest.Mock).mockResolvedValue(null);
      (opensearch.search as jest.Mock).mockResolvedValue({
        hits: { hits: [{ _id: 'dup-1', _source: {} }] },
      });

      const prismaErr = new Prisma.PrismaClientKnownRequestError('Dup', {
        code: 'P2002',
        clientVersion: '5.0',
      });
      (prisma.alert.upsert as jest.Mock).mockRejectedValue(prismaErr);

      const res = await service.syncFromOpenSearch();
      expect(res.errors).toBe(0);
    });

    it('should handle general upsert error and catch entire sync failure', async () => {
      (prisma.alert.findFirst as jest.Mock).mockResolvedValue(null);
      (opensearch.search as jest.Mock).mockResolvedValue({
        hits: { hits: [{ _id: 'err-1', _source: {} }] },
      });
      (prisma.alert.upsert as jest.Mock).mockRejectedValue(new Error('DB Error'));

      const res = await service.syncFromOpenSearch();
      expect(res.errors).toBe(1);

      // Entire failure path
      (opensearch.search as jest.Mock).mockRejectedValue(new Error('OpenSearch down'));
      const failRes = await service.syncFromOpenSearch();
      expect(failRes).toEqual({ synced: 0, errors: 0 });
    });
  });

  describe('findAll', () => {
    it('should query alerts with filters and enrich missing ruleDescription from rawLog', async () => {
      const filters = {
        status: 'new',
        level: 5,
        source: 'wazuh',
        srcIp: '1.1.1.1',
        ruleId: '100',
        mitreTechnique: 'T1059',
        incidentId: 'inc-1',
        skip: 0,
        limit: 10,
        page: 1,
      };

      const mockAlerts = [
        { id: '1', ruleDescription: 'Existing' },
        { id: '2', ruleDescription: null, rawLog: { rule: { description: 'From Raw' } } },
        { id: '3', ruleDescription: null, rawLog: { message: JSON.stringify({ rule: { description: 'From String Raw' } }) } },
      ];

      (prisma.alert.findMany as jest.Mock).mockResolvedValue(mockAlerts);
      (prisma.alert.count as jest.Mock).mockResolvedValue(3);

      const res = await service.findAll(filters as any);

      expect(res.data[1].ruleDescription).toBe('From Raw');
      expect(res.data[2].ruleDescription).toBe('From String Raw');
      expect(res.meta.total).toBe(3);
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException if alert does not exist', async () => {
      (prisma.alert.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should return alert and enrich missing ruleDescription from rawLog JSON string', async () => {
      const mockAlert = {
        id: '1',
        ruleDescription: null,
        rawLog: { message: JSON.stringify({ rule: { description: 'Enriched' } }) },
      };
      (prisma.alert.findUnique as jest.Mock).mockResolvedValue(mockAlert);

      const res = await service.findById('1');
      expect(res.ruleDescription).toBe('Enriched');
    });
  });

  describe('updateStatus', () => {
    it('should update status without auto-creating incident if status is not escalated', async () => {
      (prisma.alert.update as jest.Mock).mockResolvedValue({ id: '1', status: 'closed' });

      const res = await service.updateStatus('1', 'closed');
      expect(res.status).toBe('closed');
      expect(prisma.incident.create).not.toHaveBeenCalled();
    });

    it('should auto-create incident when status is escalated and no incidentId provided', async () => {
      const alert = {
        id: '1',
        ruleId: '100',
        ruleDescription: 'Critical Alert',
        level: 13,
        mitreTactic: 'execution',
        mitreTechnique: 'T1059',
        timestamp: new Date(),
      };

      (prisma.alert.update as jest.Mock)
        .mockResolvedValueOnce(alert)
        .mockResolvedValueOnce({ ...alert, incidentId: 'new-inc-id' });
      (prisma.incident.create as jest.Mock).mockResolvedValue({ id: 'new-inc-id' });

      await service.updateStatus('1', 'escalated');

      expect(prisma.incident.create).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          riskScore: 91,
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('incident.created', expect.anything());
    });

    it('should map level to correct severity values when auto-escalating', async () => {
      const testCases = [
        { level: null, expectedSev: 'medium' },
        { level: 12, expectedSev: 'critical' },
        { level: 8, expectedSev: 'high' },
        { level: 5, expectedSev: 'medium' },
        { level: 2, expectedSev: 'low' },
      ];

      for (const tc of testCases) {
        jest.clearAllMocks();
        const alert = { id: '1', ruleId: '1', level: tc.level };
        (prisma.alert.update as jest.Mock).mockResolvedValue(alert);
        (prisma.incident.create as jest.Mock).mockResolvedValue({ id: 'inc-id' });

        await service.updateStatus('1', 'escalated');

        expect(prisma.incident.create).toHaveBeenCalledWith(
          expect.objectContaining({ severity: tc.expectedSev }),
        );
      }
    });

    it('should catch errors gracefully if incident auto-creation fails', async () => {
      (prisma.alert.update as jest.Mock).mockResolvedValue({ id: '1', level: 10 });
      (prisma.incident.create as jest.Mock).mockRejectedValue(new Error('Incident Create Error'));

      await expect(service.updateStatus('1', 'escalated')).resolves.toBeDefined();
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should bulk update alert statuses', async () => {
      (prisma.alert.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
      const res = await service.bulkUpdateStatus(['1', '2'], 'closed');
      expect(res.count).toBe(2);
    });
  });

  describe('linkToIncident', () => {
    it('should link alerts to incident and set status to escalated', async () => {
      (prisma.alert.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
      const res = await service.linkToIncident(['1', '2'], 'inc-1');
      expect(prisma.alert.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['1', '2'] } },
        data: { incidentId: 'inc-1', status: 'escalated' },
      });
      expect(res.count).toBe(2);
    });
  });

  describe('searchInOpenSearch', () => {
    it('should execute search query in OpenSearch', async () => {
      const expectedSearchRes = { hits: { total: { value: 1 }, hits: [] } };
      (opensearch.search as jest.Mock).mockResolvedValue(expectedSearchRes);

      const res = await service.searchInOpenSearch('test-query');
      expect(res).toEqual(expectedSearchRes);
    });

    it('should handle OpenSearch errors and return empty hits response', async () => {
      (opensearch.search as jest.Mock).mockRejectedValue(new Error('OpenSearch error'));

      const res = await service.searchInOpenSearch('test-query');
      expect(res).toEqual({ hits: { total: { value: 0 }, hits: [] } });
    });
  });

  describe('getRecentCritical', () => {
    it('should fetch recent critical alerts', async () => {
      (prisma.alert.findMany as jest.Mock).mockResolvedValue([]);
      const res = await service.getRecentCritical();
      expect(prisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { level: { gte: 12 }, status: 'new' } }),
      );
      expect(res).toEqual([]);
    });
  });

  describe('countByTimeRange', () => {
    it('should count alerts within time range', async () => {
      (prisma.alert.count as jest.Mock).mockResolvedValue(10);
      const res = await service.countByTimeRange(24);
      expect(prisma.alert.count).toHaveBeenCalled();
      expect(res).toBe(10);
    });
  });

  describe('getAlertTimeline', () => {
    it('should run raw SQL query for alert timeline', async () => {
      const mockTimeline = [{ hour: new Date(), count: BigInt(5), max_level: 10 }];
      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockTimeline);

      const res = await service.getAlertTimeline(24);
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(res).toEqual(mockTimeline);
    });
  });
});