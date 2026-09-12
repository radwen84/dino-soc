import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  it('devrait être défini', () => {
    expect(service).toBeDefined();
  });

  it('devrait initialiser tous les collecteurs de métriques', () => {
    expect(service.registry).toBeDefined();
    expect(service.httpRequestDuration).toBeDefined();
    expect(service.httpRequestsTotal).toBeDefined();
    expect(service.incidentsCreated).toBeDefined();
    expect(service.alertsProcessed).toBeDefined();
    expect(service.iocMatches).toBeDefined();
    expect(service.authLoginFailures).toBeDefined();
    expect(service.authLoginSuccess).toBeDefined();
    expect(service.soarExecutionsTotal).toBeDefined();
    expect(service.soarFailuresTotal).toBeDefined();
    expect(service.mlPredictionsTotal).toBeDefined();
    expect(service.mlAnomaliesTotal).toBeDefined();
    expect(service.activeIncidents).toBeDefined();
    expect(service.activeAlerts).toBeDefined();
    expect(service.connectedUsers).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('devrait collecter les métriques par défaut lors de l’initialisation du module', () => {
      service.onModuleInit();
      expect(service.registry.metrics()).resolves.toBeDefined();
    });
  });

  describe('getMetrics', () => {
    it('devrait retourner les métriques sous forme de chaîne de caractères', async () => {
      const metricsOutput = await service.getMetrics();
      expect(typeof metricsOutput).toBe('string');
      expect(metricsOutput).toContain('http_requests_total');
    });
  });
});