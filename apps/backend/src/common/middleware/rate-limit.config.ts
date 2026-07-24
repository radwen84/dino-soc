import { ThrottlerModuleOptions } from '@nestjs/throttler';

export function getRateLimitConfig(): ThrottlerModuleOptions {
  return [
    {
      name: 'short',
      ttl: 1000, // 1 second
      limit: 10,
    },
    {
      name: 'medium',
      ttl: 60000, // 1 minute
      limit: 100,
    },
    {
      name: 'long',
      ttl: 3600000, // 1 hour
      limit: 1000,
    },
  ];
}

// Stricter limits for auth endpoints
export const AUTH_THROTTLE = { ttl: 60000, limit: 5 }; // 5 attempts/minute
export const LOGIN_THROTTLE = { ttl: 900000, limit: 10 }; // 10 attempts/15min
export const MFA_THROTTLE = { ttl: 60000, limit: 3 }; // 3 attempts/minute
