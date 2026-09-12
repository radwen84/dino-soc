import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;
  let metricsService: jest.Mocked<MetricsService>;

  beforeEach(async () => {
    const mockMetricsService = {
      httpRequestDuration: {
        labels: jest.fn().mockReturnValue({ observe: jest.fn() }),
      },
      httpRequestsTotal: {
        labels: jest.fn().mockReturnValue({ inc: jest.fn() }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsInterceptor,
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    interceptor = module.get<MetricsInterceptor>(MetricsInterceptor);
    metricsService = module.get(MetricsService);
  });

  it('devrait être défini', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    let mockExecutionContext: ExecutionContext;
    let mockCallHandler: CallHandler;
    let mockRequest: any;
    let mockResponse: any;

    beforeEach(() => {
      mockRequest = {
        method: 'GET',
        route: { path: '/api/v1/test' },
        path: '/api/v1/test',
      };
      mockResponse = {
        statusCode: 200,
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as unknown as ExecutionContext;
    });

    it('devrait enregistrer les métriques avec succès à la fin d’une requête', (done) => {
      mockCallHandler = {
        handle: () => of('données de réponse'),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(metricsService.httpRequestDuration.labels).toHaveBeenCalledWith('GET', '/api/v1/test', '200');
          expect(metricsService.httpRequestsTotal.labels).toHaveBeenCalledWith('GET', '/api/v1/test', '200');
          done();
        },
      });
    });

    it('devrait utiliser req.path si req.route.path n’est pas défini', (done) => {
      mockRequest.route = undefined;
      mockCallHandler = {
        handle: () => of('données de réponse'),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(metricsService.httpRequestDuration.labels).toHaveBeenCalledWith('GET', '/api/v1/test', '200');
          done();
        },
      });
    });

    it('devrait utiliser "unknown" si route et path ne sont pas définis', (done) => {
      mockRequest.route = undefined;
      mockRequest.path = undefined;
      mockCallHandler = {
        handle: () => of('données de réponse'),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(metricsService.httpRequestDuration.labels).toHaveBeenCalledWith('GET', 'unknown', '200');
          done();
        },
      });
    });

    it('devrait enregistrer les métriques en cas d’erreur HTTP avec error.status', (done) => {
      const error = { status: 404 };
      mockCallHandler = {
        handle: () => throwError(() => error),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: () => {
          expect(metricsService.httpRequestDuration.labels).toHaveBeenCalledWith('GET', '/api/v1/test', '404');
          expect(metricsService.httpRequestsTotal.labels).toHaveBeenCalledWith('GET', '/api/v1/test', '404');
          done();
        },
      });
    });

    it('devrait enregistrer les métriques en cas d’erreur HTTP avec la méthode error.getStatus()', (done) => {
      const error = { getStatus: () => 403 };
      mockCallHandler = {
        handle: () => throwError(() => error),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: () => {
          expect(metricsService.httpRequestDuration.labels).toHaveBeenCalledWith('GET', '/api/v1/test', '403');
          done();
        },
      });
    });

    it('devrait utiliser le code de statut 500 par défaut si aucun statut n’est précisé dans l’erreur', (done) => {
      const error = new Error('Erreur interne du serveur');
      mockCallHandler = {
        handle: () => throwError(() => error),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: () => {
          expect(metricsService.httpRequestDuration.labels).toHaveBeenCalledWith('GET', '/api/v1/test', '500');
          done();
        },
      });
    });
  });
});