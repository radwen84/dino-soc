import { Test, TestingModule } from '@nestjs/testing';
import { SoarService } from '../../src/soar/soar.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuditService } from '../../src/audit/audit.service';
import { PlaybookEngine } from '../../src/soar/playbook-engine.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlaybookActionType } from '../../src/soar/dto/create-playbook.dto';

describe('SoarService', () => {
  let service: SoarService;
  let module: TestingModule;
  let mockPrisma: any;
  let mockPlaybookEngine: any;

  beforeEach(async () => {
    mockPrisma = {
      playbook: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    mockPlaybookEngine = {
      validateDAG: jest.fn().mockReturnValue(true),
      executePlaybook: jest.fn().mockResolvedValue({
        executionId: 'exec-1',
        status: 'success',
        executedActions: [],
        pendingApprovals: [],
      }),
    };

    module = await Test.createTestingModule({
      providers: [
        SoarService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: PlaybookEngine, useValue: mockPlaybookEngine },
      ],
    }).compile();

    service = module.get<SoarService>(SoarService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (module) {
      await module.close();
    }
  });

  describe('getPlaybooks', () => {
    it('should return all playbooks ordered by creation date', async () => {
      const mockPlaybooks = [{ id: 'pb-1', name: 'Test Playbook' }];
      mockPrisma.playbook.findMany.mockResolvedValue(mockPlaybooks);

      const result = await service.getPlaybooks();

      expect(result).toEqual(mockPlaybooks);
      expect(mockPrisma.playbook.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: { createdBy: { select: { id: true, name: true } } },
      });
    });
  });

  describe('createPlaybook', () => {
    const validDto = {
      name: 'Test Playbook',
      description: 'Test',
      triggerConditions: { triggerType: 'alert', rules: [] },
      actions: [
        { id: 'a1', name: 'Notify', type: PlaybookActionType.NOTIFY, params: { message: 'test' } },
      ],
    };

    it('should create a playbook with valid DAG', async () => {
      mockPrisma.playbook.create.mockResolvedValue({ id: 'pb-1', ...validDto });

      const result = await service.createPlaybook(validDto, 'user-1');

      expect(result.id).toBe('pb-1');
      expect(mockPlaybookEngine.validateDAG).toHaveBeenCalledWith(validDto.actions);
      expect(mockPrisma.playbook.create).toHaveBeenCalled();
    });

    it('should reject playbook with invalid DAG', async () => {
      mockPlaybookEngine.validateDAG.mockReturnValue(false);

      await expect(service.createPlaybook(validDto, 'user-1')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.playbook.create).not.toHaveBeenCalled();
    });
  });

  describe('getPlaybook', () => {
    it('should return playbook if found', async () => {
      mockPrisma.playbook.findUnique.mockResolvedValue({ id: 'pb-1', name: 'Test' });

      const result = await service.getPlaybook('pb-1');
      expect(result.name).toBe('Test');
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.playbook.findUnique.mockResolvedValue(null);

      await expect(service.getPlaybook('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('executeManually', () => {
    it('should execute playbook with dry-run', async () => {
      mockPrisma.playbook.findUnique.mockResolvedValue({
        id: 'pb-1',
        name: 'Test',
        triggerConditions: { triggerType: 'alert' },
        actions: [],
      });

      await service.executeManually('pb-1', { testData: { level: 12 }, dryRun: true }, 'user-1');

      expect(mockPlaybookEngine.executePlaybook).toHaveBeenCalledWith(
        expect.any(Object),
        { level: 12 },
        true,
      );
    });
  });

  describe('togglePlaybook', () => {
    it('should toggle playbook active status', async () => {
      mockPrisma.playbook.findUnique.mockResolvedValue({ id: 'pb-1', isActive: true });
      mockPrisma.playbook.update.mockResolvedValue({ id: 'pb-1', isActive: false });

      const result = await service.togglePlaybook('pb-1', 'user-1');
      expect(result.isActive).toBe(false);
    });
  });

  describe('getDefaultPlaybooks', () => {
    it('should return array of predefined default playbooks', async () => {
      const result = await service.getDefaultPlaybooks();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('actions');
    });
  });
});