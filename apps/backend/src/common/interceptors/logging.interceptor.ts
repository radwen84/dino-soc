import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode as number;
        const duration = Date.now() - now;

        const logMessage = `${method} ${url} ${statusCode} ${duration}ms - ${ip} ${userAgent}`;

        if (duration > 3000) {
          this.logger.warn(`SLOW REQUEST: ${logMessage}`);
        } else {
          this.logger.log(logMessage);
        }
      }),
    );
  }
}
