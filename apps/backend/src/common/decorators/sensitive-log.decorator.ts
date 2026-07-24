import { Logger } from '@nestjs/common';

const SENSITIVE_FIELDS = ['password', 'passwordHash', 'token', 'secret', 'mfaSecret', 'apiKey'];

export function sanitizeForLogging(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key of Object.keys(sanitized)) {
    if (SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }

  return sanitized;
}

export function LogSensitive() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const logger = new Logger(target.constructor.name);

    descriptor.value = function (...args: any[]) {
      const sanitizedArgs = args.map((arg) => sanitizeForLogging(arg));
      logger.debug(`${propertyKey} called with: ${JSON.stringify(sanitizedArgs)}`);
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
