import { Test, TestingModule } from '@nestjs/testing';
import { IocService } from '../../src/ioc/ioc.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuditService } from '../../src/audit/audit.service';
import { OpenSearchService } from '../../src/opensearch/opensearch.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('IocService', () => {
  let service: IocService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrisma = {
    iOC: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const mockAudit = { log: jest.fn() };
  const mockOpenSearch = { index: jest.fn() };
  const mockEventEmitter = { emit: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IocService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: OpenSearchService, useValue: mockOpenSearch },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<IocService>(IocService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      type: 'ip' as const,
      value: '192.168.1.100',
      confidence: 80,
      description: 'Test IOC',
    };

    it('should create an IOC successfully', async () => {
      mockPrisma.iOC.findUnique.mockResolvedValue(null);
      mockPrisma.iOC.create.mockResolvedValue({
        id: 'test-uuid',
        ...createDto,
        status: 'active',
        severity: 'medium',
        createdAt: new Date(),
      });

      const result = await service.create(createDto, 'user-id');

      expect(result.id).toBe('test-uuid');
      expect(mockPrisma.iOC.create).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith('IOC_CREATED', expect.any(Object));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('ioc.created', expect.any(Object));
    });

    it('should throw ConflictException if IOC already exists', async () => {
      mockPrisma.iOC.findUnique.mockResolvedValue({
        id: 'existing',
        type: 'ip',
        value: '192.168.1.100',
      });

      await expect(service.create(createDto, 'user-id')).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('should return IOC if found', async () => {
      const mockIoc = { id: 'uuid', type: 'ip', value: '10.0.0.1' };
      mockPrisma.iOC.findUnique.mockResolvedValue(mockIoc);

      const result = await service.findOne('uuid');
      expect(result).toEqual(mockIoc);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.iOC.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('matchValue', () => {
    it('should return active IOCs matching the value', async () => {
      const mockResults = [
        { id: '1', type: 'ip', value: '10.0.0.1', confidence: 90, status: 'active' },
      ];
      mockPrisma.iOC.findMany.mockResolvedValue(mockResults);

      const result = await service.matchValue('10.0.0.1');
      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(90);
    });
  });

  describe('bulkImport', () => {
    it('should create new IOCs and skip existing ones', async () => {
      const iocs = [
        { type: 'ip' as const, value: '1.2.3.4', confidence: 70 },
        { type: 'ip' as const, value: '5.6.7.8', confidence: 60 },
      ];

      mockPrisma.iOC.findUnique
        .mockResolvedValueOnce({ id: 'existing' }) // First exists
        .mockResolvedValueOnce(null); // Second is new

      mockPrisma.iOC.update.mockResolvedValue({});
      mockPrisma.iOC.create.mockResolvedValue({ id: 'new-uuid', ...iocs[1], status: 'active' });

      const result = await service.bulkImport(iocs, 'system');

      expect(result.skipped).toBe(1);
      expect(result.created).toBe(1);
    });
  });
});
