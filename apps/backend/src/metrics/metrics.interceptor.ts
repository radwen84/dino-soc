import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          this.recordMetrics(req, res.statusCode, startTime);
        },
        error: (error) => {
          const status = error.status || error.getStatus?.() || 500;
          this.recordMetrics(req, status, startTime);
        },
      }),
    );
  }

  private recordMetrics(req: Request, status: number, startTime: number) {
    const duration = (Date.now() - startTime) / 1000;
    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;

    this.metricsService.httpRequestDuration.labels(method, route, String(status)).observe(duration);

    this.metricsService.httpRequestsTotal.labels(method, route, String(status)).inc();
  }
}
