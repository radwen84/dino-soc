import { Test, TestingModule } from '@nestjs/testing';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertFiltersDto } from './dto/alert-filters.dto';

describe('AlertsController', () => {
  let controller: AlertsController;
  let service: jest.Mocked<AlertsService>;

  beforeEach(async () => {
    const mockAlertsService = {
      findAll: jest.fn(),
      getRecentCritical: jest.fn(),
      getAlertTimeline: jest.fn(),
      searchInOpenSearch: jest.fn(),
      syncFromOpenSearch: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
      bulkUpdateStatus: jest.fn(),
      linkToIncident: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [
        {
          provide: AlertsService,
          useValue: mockAlertsService,
        },
      ],
    }).compile();

    controller = module.get<AlertsController>(AlertsController);
    service = module.get(AlertsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call alertsService.findAll with filters', async () => {
      const filters: AlertFiltersDto = { page: 1, limit: 10 } as any;
      const expectedResult = { data: [], meta: {} };
      service.findAll.mockResolvedValue(expectedResult as any);

      const result = await controller.findAll(filters);

      expect(service.findAll).toHaveBeenCalledWith(filters);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getRecentCritical', () => {
    it('should call alertsService.getRecentCritical', async () => {
      service.getRecentCritical.mockResolvedValue([]);

      const result = await controller.getRecentCritical();

      expect(service.getRecentCritical).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('getTimeline', () => {
    it('should call alertsService.getAlertTimeline with default hours if omitted', async () => {
      service.getAlertTimeline.mockResolvedValue([]);

      const result = await controller.getTimeline();

      expect(service.getAlertTimeline).toHaveBeenCalledWith(24);
      expect(result).toEqual([]);
    });

    it('should call alertsService.getAlertTimeline with specified hours', async () => {
      service.getAlertTimeline.mockResolvedValue([]);

      const result = await controller.getTimeline(12);

      expect(service.getAlertTimeline).toHaveBeenCalledWith(12);
      expect(result).toEqual([]);
    });
  });

  describe('search', () => {
    it('should call alertsService.searchInOpenSearch with parameters', async () => {
      service.searchInOpenSearch.mockResolvedValue({ hits: [] });

      const result = await controller.search('test', 0, 10);

      expect(service.searchInOpenSearch).toHaveBeenCalledWith('test', 0, 10);
      expect(result).toEqual({ hits: [] });
    });
  });

  describe('syncWazuh', () => {
    it('should trigger syncFromOpenSearch and return result message', async () => {
      const syncResult = { synced: 5, errors: 0 };
      service.syncFromOpenSearch.mockResolvedValue(syncResult);

      const result = await controller.syncWazuh();

      expect(service.syncFromOpenSearch).toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Sync completed',
        ...syncResult,
      });
    });
  });

  describe('findOne', () => {
    it('should call alertsService.findById', async () => {
      const alertId = 'uuid-123';
      service.findById.mockResolvedValue({ id: alertId } as any);

      const result = await controller.findOne(alertId);

      expect(service.findById).toHaveBeenCalledWith(alertId);
      expect(result).toEqual({ id: alertId });
    });
  });

  describe('updateStatus', () => {
    it('should call alertsService.updateStatus', async () => {
      const alertId = 'uuid-123';
      const status = 'closed';
      service.updateStatus.mockResolvedValue({ id: alertId, status } as any);

      const result = await controller.updateStatus(alertId, status);

      expect(service.updateStatus).toHaveBeenCalledWith(alertId, status);
      expect(result).toEqual({ id: alertId, status });
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should call alertsService.bulkUpdateStatus', async () => {
      const ids = ['uuid-1', 'uuid-2'];
      const status = 'closed';
      service.bulkUpdateStatus.mockResolvedValue({ count: 2 });

      const result = await controller.bulkUpdateStatus(ids, status);

      expect(service.bulkUpdateStatus).toHaveBeenCalledWith(ids, status);
      expect(result).toEqual({ count: 2 });
    });
  });

  describe('linkToIncident', () => {
    it('should call alertsService.linkToIncident', async () => {
      const alertIds = ['uuid-1', 'uuid-2'];
      const incidentId = 'inc-123';
      service.linkToIncident.mockResolvedValue({ count: 2 });

      const result = await controller.linkToIncident(alertIds, incidentId);

      expect(service.linkToIncident).toHaveBeenCalledWith(alertIds, incidentId);
      expect(result).toEqual({ count: 2 });
    });
  });
});