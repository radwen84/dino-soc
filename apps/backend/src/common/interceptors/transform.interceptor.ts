import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If data already has a 'data' property (pagination), pass through
        if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
          return {
            ...data,
            timestamp: new Date().toISOString(),
          };
        }
        return {
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
