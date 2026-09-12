import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let service: jest.Mocked<MetricsService>;

  beforeEach(async () => {
    const mockMetricsService = {
      getMetrics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    service = module.get(MetricsService);
  });

  it('devrait être défini', () => {
    expect(controller).toBeDefined();
  });

  describe('getMetrics', () => {
    it('devrait appeler metricsService.getMetrics et retourner les métriques', async () => {
      const mockMetricsData = '# HELP http_requests_total Total HTTP requests\n';
      service.getMetrics.mockResolvedValue(mockMetricsData);

      const result = await controller.getMetrics();

      expect(service.getMetrics).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockMetricsData);
    });
  });
});