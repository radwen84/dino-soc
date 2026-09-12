import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IncidentsService } from './incidents.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MlEngineService } from './ml-engine.service';
import { TheHiveService } from './thehive.service';

describe('IncidentsService', () => {
  let service: IncidentsService;
  let prisma: jest.Mocked<PrismaService>;
  let auditService: jest.Mocked<AuditService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let mlEngine: jest.Mocked<MlEngineService>;
  let theHive: jest.Mocked<TheHiveService>;

  const mockPrismaService = {
    incident: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    alert: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const mockAuditService = { log: jest.fn() };
  const mockEventEmitter = { emit: jest.fn() };
  const mockMlEngineService = { getRiskScore: jest.fn() };
  const mockTheHiveService = { pushIncident: jest.fn(), runAnalyzers: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: MlEngineService, useValue: mockMlEngineService },
        { provide: TheHiveService, useValue: mockTheHiveService },
      ],
    }).compile();

    service = module.get<IncidentsService>(IncidentsService);
    prisma = module.get(PrismaService);
    auditService = module.get(AuditService);
    eventEmitter = module.get(EventEmitter2);
    mlEngine = module.get(MlEngineService);
    theHive = module.get(TheHiveService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('devrait créer un incident avec score ML et l’envoyer sur TheHive avec les IP d’alertes', async () => {
      const dto = {
        title: 'Attaque Ransomware',
        description: 'Chiffrement détecté',
        severity: 'critical',
        category: 'ransomware',
        sourceAlertIds: ['alert-1', 'alert-2'],
      };
      const userId = 'user-1';
      const createdIncident = { id: 'inc-100', ...dto, riskScore: 95, detectedAt: new Date() };

      mlEngine.getRiskScore.mockResolvedValue({ risk_score: 95, confidence: 0.9 });
      prisma.incident.create.mockResolvedValue(createdIncident as any);
      theHive.pushIncident.mockResolvedValue({ _id: 'hive-123' } as any);
      prisma.alert.findMany.mockResolvedValue([
        { srcIp: '192.168.1.10', dstIp: '10.0.0.1' },
        { srcIp: '192.168.1.10', dstIp: null },
      ] as any);
      theHive.runAnalyzers.mockResolvedValue(undefined as any);

      const result = await service.create(dto as any, userId);

      expect(mlEngine.getRiskScore).toHaveBeenCalled();
      expect(prisma.incident.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ riskScore: 95 }),
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith('INCIDENT_CREATED', expect.any(Object));
      expect(eventEmitter.emit).toHaveBeenCalledWith('incident.created', createdIncident);
      expect(result).toEqual(createdIncident);

      // Attente pour l'exécution asynchrone (fire-and-forget) de pushToTheHive
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(theHive.pushIncident).toHaveBeenCalled();
      expect(prisma.alert.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['alert-1', 'alert-2'] } },
        select: { srcIp: true, dstIp: true },
      });
      expect(theHive.runAnalyzers).toHaveBeenCalledWith('ip', '192.168.1.10');
      expect(theHive.runAnalyzers).toHaveBeenCalledWith('ip', '10.0.0.1');
    });

    it('devrait utiliser le calcul de risque par règles si le ML échoue et gérer l’erreur pushToTheHive', async () => {
      const dto = { title: 'Connexion suspecte', severity: 'low', category: 'apt' };
      const userId = 'user-1';
      const createdIncident = { id: 'inc-101', ...dto, riskScore: 40, detectedAt: new Date() };

      mlEngine.getRiskScore.mockResolvedValue(null);
      prisma.incident.create.mockResolvedValue(createdIncident as any);
      theHive.pushIncident.mockRejectedValue(new Error('TheHive hors ligne'));

      const result = await service.create(dto as any, userId);

      expect(prisma.incident.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ riskScore: 40 }), // 25 (faible) + 15 (apt) = 40
        }),
      );
      expect(result).toEqual(createdIncident);
    });
  });

  describe('findAll', () => {
    it('devrait appliquer correctement tous les filtres et retourner les données paginées', async () => {
      const filters = {
        status: 'open',
        severity: 'high',
        assignedTo: 'user-2',
        category: 'malware',
        source: 'siem',
        search: 'breach',
        mitreTechnique: 'T1059',
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
        page: 2,
        limit: 5,
        skip: 5,
        sortBy: 'title',
        sortOrder: 'asc',
      };

      prisma.incident.findMany.mockResolvedValue([{ id: 'inc-1' }] as any);
      prisma.incident.count.mockResolvedValue(12);

      const result = await service.findAll(filters as any);

      expect(prisma.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
          orderBy: { title: 'asc' },
          where: expect.objectContaining({
            status: 'open',
            severity: 'high',
            assignedToId: 'user-2',
            category: 'malware',
            source: 'siem',
            mitreTechniques: { has: 'T1059' },
            OR: [
              { title: { contains: 'breach', mode: 'insensitive' } },
              { description: { contains: 'breach', mode: 'insensitive' } },
            ],
          }),
        }),
      );
      expect(result.meta).toEqual({
        total: 12,
        page: 2,
        limit: 5,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });
  });

  describe('findById', () => {
    it('devrait retourner l’incident s’il existe et n’est pas supprimé', async () => {
      const mockInc = { id: 'inc-1', title: 'Test' };
      prisma.incident.findUnique.mockResolvedValue(mockInc as any);

      const result = await service.findById('inc-1');
      expect(result).toEqual(mockInc);
    });

    it('devrait lever une NotFoundException si l’incident est introuvable ou supprimé', async () => {
      prisma.incident.findUnique.mockResolvedValue(null);
      await expect(service.findById('inc-1')).rejects.toThrow(NotFoundException);

      prisma.incident.findUnique.mockResolvedValue({ id: 'inc-1', deletedAt: new Date() } as any);
      await expect(service.findById('inc-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('devrait gérer les transitions de statut et enregistrer les horodatages associés', async () => {
      const existingIncident = { id: 'inc-1', status: 'new' };
      jest.spyOn(service, 'findById').mockResolvedValue(existingIncident as any);
      prisma.incident.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 'inc-1', ...data }));

      // Statut 'triaged'
      await service.update('inc-1', { status: 'triaged' }, 'user-1');
      expect(prisma.incident.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ acknowledgedAt: expect.any(Date) }),
        }),
      );

      // Statut 'contained'
      await service.update('inc-1', { status: 'contained' }, 'user-1');
      expect(prisma.incident.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ containedAt: expect.any(Date) }),
        }),
      );

      // Statut 'closed'
      await service.update('inc-1', { status: 'closed' }, 'user-1');
      expect(prisma.incident.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resolvedAt: expect.any(Date),
            closedAt: expect.any(Date),
          }),
        }),
      );

      expect(auditService.log).toHaveBeenCalledWith('INCIDENT_UPDATED', expect.any(Object));
      expect(eventEmitter.emit).toHaveBeenCalledWith('incident.status_changed', expect.any(Object));
    });
  });

  describe('assign, escalate, close, softDelete', () => {
    it('devrait assigner un incident et émettre un événement', async () => {
      const updatedMock = { id: 'inc-1', assignedToId: 'user-2', status: 'triaged' };
      prisma.incident.update.mockResolvedValue(updatedMock as any);

      const result = await service.assign('inc-1', 'user-2', 'user-1');
      expect(result).toEqual(updatedMock);
      expect(auditService.log).toHaveBeenCalledWith('INCIDENT_ASSIGNED', expect.any(Object));
      expect(eventEmitter.emit).toHaveBeenCalledWith('incident.assigned', expect.any(Object));
    });

    it('devrait escalader un incident et émettre un événement', async () => {
      const updatedMock = { id: 'inc-1', escalatedToId: 'user-3', status: 'investigating' };
      prisma.incident.update.mockResolvedValue(updatedMock as any);

      const result = await service.escalate('inc-1', 'user-3', 'Menace complexe', 'user-1');
      expect(result).toEqual(updatedMock);
      expect(auditService.log).toHaveBeenCalledWith('INCIDENT_ESCALATED', expect.any(Object));
      expect(eventEmitter.emit).toHaveBeenCalledWith('incident.escalated', expect.any(Object));
    });

    it('devrait fermer un incident avec le retour d’expérience', async () => {
      const updatedMock = { id: 'inc-1', status: 'closed', lessonsLearned: 'Corrigé' };
      prisma.incident.update.mockResolvedValue(updatedMock as any);

      const result = await service.close('inc-1', 'Corrigé', 'user-1');
      expect(result).toEqual(updatedMock);
      expect(auditService.log).toHaveBeenCalledWith('INCIDENT_CLOSED', expect.any(Object));
    });

    it('devrait effectuer la suppression logique d’un incident', async () => {
      prisma.incident.update.mockResolvedValue({ id: 'inc-1' } as any);

      await service.softDelete('inc-1', 'user-1');
      expect(prisma.incident.update).toHaveBeenCalledWith({
        where: { id: 'inc-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(auditService.log).toHaveBeenCalledWith('INCIDENT_DELETED', expect.any(Object));
    });
  });

  describe('getStatistics', () => {
    it('devrait calculer et retourner les métriques du tableau de bord', async () => {
      prisma.incident.count.mockResolvedValueOnce(10).mockResolvedValueOnce(2);
      prisma.alert.count.mockResolvedValue(45);
      prisma.incident.aggregate.mockResolvedValue({ _avg: { riskScore: 78.4 } } as any);
      prisma.incident.groupBy.mockResolvedValueOnce([{ status: 'new', _count: 5 }] as any);
      prisma.incident.groupBy.mockResolvedValueOnce([{ severity: 'critical', _count: 2 }] as any);
      prisma.$queryRaw.mockResolvedValue([{ technique: 'T1059', count: 4 }] as any);
      prisma.incident.findMany.mockResolvedValue([{ id: 'inc-1', title: 'Inc 1' }] as any);

      const stats = await service.getStatistics();

      expect(stats).toEqual({
        overview: {
          openIncidents: 10,
          criticalIncidents: 2,
          newAlerts24h: 45,
          avgRiskScore: 78,
        },
        byStatus: [{ status: 'new', _count: 5 }],
        bySeverity: [{ severity: 'critical', _count: 2 }],
        topMitreTechniques: [{ technique: 'T1059', count: 4 }],
        recentIncidents: [{ id: 'inc-1', title: 'Inc 1' }],
      });
    });
  });
});