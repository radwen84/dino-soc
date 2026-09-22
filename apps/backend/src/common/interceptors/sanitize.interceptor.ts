import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.body) {
      request.body = this.sanitizeObject(request.body);
    }
    if (request.query) {
      request.query = this.sanitizeObject(request.query) as Request['query'];
    }
    if (request.params) {
      request.params = this.sanitizeObject(request.params) as Request['params'];
    }

    return next.handle();
  }

  private sanitizeObject(obj: unknown): unknown {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }
    if (obj && typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        sanitized[this.sanitizeString(key)] = this.sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  }

  private sanitizeString(str: string): string {
    return str
      .replace(/[<>]/g, '') // Strip HTML tags
      .replace(/javascript:/gi, '') // Strip javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Strip event handlers
      .trim();
  }
}
