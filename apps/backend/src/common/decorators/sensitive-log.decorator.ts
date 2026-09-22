import { Logger } from '@nestjs/common';

const SENSITIVE_FIELDS = ['password', 'passwordHash', 'token', 'secret', 'mfaSecret', 'apiKey'];

export function sanitizeForLogging(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLogging(item));
  }

  const record = obj as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function LogSensitive(): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;
    const logger = new Logger(target.constructor.name);

    descriptor.value = function (this: unknown, ...args: unknown[]): unknown {
      const sanitizedArgs = args.map((arg) => sanitizeForLogging(arg));
      logger.debug(`${String(propertyKey)} called with: ${JSON.stringify(sanitizedArgs)}`);
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
