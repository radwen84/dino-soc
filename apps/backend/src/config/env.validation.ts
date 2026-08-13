import { Logger } from '@nestjs/common';

const logger = new Logger('EnvValidation');

interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  REDIS_URL?: string;
  OPENSEARCH_NODE?: string;
  CORS_ORIGINS?: string;
}

export function validate(config: Record<string, unknown>): EnvConfig {
  const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = requiredVars.filter((key) => !config[key]);

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  // Validate JWT_SECRET strength
  const jwtSecret = config.JWT_SECRET as string;
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  return {
    NODE_ENV: (config.NODE_ENV as string) || 'development',
    PORT: parseInt((config.API_PORT || config.PORT) as string, 10) || 4000,
    DATABASE_URL: config.DATABASE_URL as string,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: (config.JWT_EXPIRES_IN as string) || '15m',
    JWT_REFRESH_EXPIRES_IN: (config.JWT_REFRESH_EXPIRES_IN as string) || '7d',
    REDIS_URL: config.REDIS_URL as string,
    OPENSEARCH_NODE: config.OPENSEARCH_NODE as string,
    CORS_ORIGINS: config.CORS_ORIGINS as string,
  };
}
