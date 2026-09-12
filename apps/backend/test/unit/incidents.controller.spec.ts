import { Test, TestingModule } from '@nestjs/testing';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { IncidentFiltersDto } from './dto/incident-filters.dto';
import { JwtPayload } from '../common/decorators/current-user.decorator';

describe('IncidentsController', () => {
  let controller: IncidentsController;
  let service: jest.Mocked<IncidentsService>;

  const mockUser: JwtPayload = {
    sub: 'user-uuid-1234',
    email: 'analyst@soc.com',
    roles: ['ANALYST_L2'],
  } as any;

  const mockIncidentsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    getStatistics: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    assign: jest.fn(),
    escalate: jest.fn(),
    close: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IncidentsController],
      providers: [
        {
          provide: IncidentsService,
          useValue: mockIncidentsService,
        },
      ],
    }).compile();

    controller = module.get<IncidentsController>(IncidentsController);
    service = module.get(IncidentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('devrait être défini', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('devrait créer un incident', async () => {
      const dto: CreateIncidentDto = {
        title: 'Incident de test',
        description: 'Description de test',
        severity: 'high',
        category: 'malware',
      } as any;
      const expectedResult = { id: 'inc-123', ...dto };

      service.create.mockResolvedValue(expectedResult as any);

      const result = await controller.create(dto, mockUser);
      expect(service.create).toHaveBeenCalledWith(dto, mockUser.sub);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findAll', () => {
    it('devrait retourner les incidents paginés', async () => {
      const filters: IncidentFiltersDto = { page: 1, limit: 10 } as any;
      const expectedResult = { data: [], meta: { total: 0 } };

      service.findAll.mockResolvedValue(expectedResult as any);

      const result = await controller.findAll(filters);
      expect(service.findAll).toHaveBeenCalledWith(filters);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getStatistics', () => {
    it('devrait retourner les statistiques des incidents', async () => {
      const mockStats = { overview: { openIncidents: 5 } };
      service.getStatistics.mockResolvedValue(mockStats as any);

      const result = await controller.getStatistics();
      expect(service.getStatistics).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('findOne', () => {
    it('devrait retourner un incident par son ID', async () => {
      const mockIncident = { id: 'inc-123', title: 'Test' };
      service.findById.mockResolvedValue(mockIncident as any);

      const result = await controller.findOne('inc-123');
      expect(service.findById).toHaveBeenCalledWith('inc-123');
      expect(result).toEqual(mockIncident);
    });
  });

  describe('update', () => {
    it('devrait mettre à jour un incident', async () => {
      const dto: UpdateIncidentDto = { title: 'Titre mis à jour' };
      const mockUpdated = { id: 'inc-123', ...dto };
      service.update.mockResolvedValue(mockUpdated as any);

      const result = await controller.update('inc-123', dto, mockUser);
      expect(service.update).toHaveBeenCalledWith('inc-123', dto, mockUser.sub);
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('assign', () => {
    it('devrait assigner un incident à un utilisateur', async () => {
      const assignToUserId = 'user-target-456';
      const mockAssigned = { id: 'inc-123', assignedToId: assignToUserId };
      service.assign.mockResolvedValue(mockAssigned as any);

      const result = await controller.assign('inc-123', assignToUserId, mockUser);
      expect(service.assign).toHaveBeenCalledWith('inc-123', assignToUserId, mockUser.sub);
      expect(result).toEqual(mockAssigned);
    });
  });

  describe('escalate', () => {
    it('devrait escalader un incident', async () => {
      const escalateToUserId = 'user-tier3-789';
      const reason = 'Intrusion critique';
      const mockEscalated = { id: 'inc-123', status: 'investigating' };
      service.escalate.mockResolvedValue(mockEscalated as any);

      const result = await controller.escalate('inc-123', escalateToUserId, reason, mockUser);
      expect(service.escalate).toHaveBeenCalledWith('inc-123', escalateToUserId, reason, mockUser.sub);
      expect(result).toEqual(mockEscalated);
    });
  });

  describe('close', () => {
    it('devrait fermer un incident', async () => {
      const lessonsLearned = 'Règles du pare-feu mises à jour.';
      const mockClosed = { id: 'inc-123', status: 'closed' };
      service.close.mockResolvedValue(mockClosed as any);

      const result = await controller.close('inc-123', lessonsLearned, mockUser);
      expect(service.close).toHaveBeenCalledWith('inc-123', lessonsLearned, mockUser.sub);
      expect(result).toEqual(mockClosed);
    });
  });

  describe('delete', () => {
    it('devrait effectuer une suppression logique (soft delete) d’un incident', async () => {
      service.softDelete.mockResolvedValue(undefined);

      await controller.delete('inc-123', mockUser);
      expect(service.softDelete).toHaveBeenCalledWith('inc-123', mockUser.sub);
    });
  });
});