import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

interface HttpErrorWithStatus {
  status?: number;
  getStatus?: () => number;
}

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          this.recordMetrics(req, res.statusCode, startTime);
        },
        error: (error: unknown) => {
          const err = error as HttpErrorWithStatus;
          const status = err?.status || err?.getStatus?.() || 500;
          this.recordMetrics(req, status, startTime);
        },
      }),
    );
  }

  private recordMetrics(req: Request, status: number, startTime: number): void {
    const duration = (Date.now() - startTime) / 1000;
    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;

    this.metricsService.httpRequestDuration.labels(method, route, String(status)).observe(duration);

    this.metricsService.httpRequestsTotal.labels(method, route, String(status)).inc();
  }
}
