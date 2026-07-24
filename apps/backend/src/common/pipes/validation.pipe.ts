import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

export function getValidationPipeConfig(): ValidationPipeOptions {
  return {
    whitelist: true, // Strip unknown properties
    forbidNonWhitelisted: true, // Throw on unknown properties
    transform: true, // Auto-transform payloads to DTO types
    transformOptions: {
      enableImplicitConversion: true,
    },
    disableErrorMessages: process.env.NODE_ENV === 'production',
    stopAtFirstError: false,
  };
}

export const AppValidationPipe = new ValidationPipe(getValidationPipeConfig());