import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function getCorsConfig(): CorsOptions {
  const allowedOrigins = (process.env.API_CORS_ORIGINS || process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim());

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, health checks)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Forwarded-For'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
    credentials: true,
    maxAge: 86400, // 24h preflight cache
  };
}
