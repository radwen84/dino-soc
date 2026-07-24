import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    if (request.body) {
      request.body = this.sanitizeObject(request.body);
    }
    if (request.query) {
      request.query = this.sanitizeObject(request.query);
    }
    if (request.params) {
      request.params = this.sanitizeObject(request.params);
    }

    return next.handle();
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
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
