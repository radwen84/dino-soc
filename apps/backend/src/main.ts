import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import compression = require('compression');
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { SanitizeInterceptor } from './common/interceptors/sanitize.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { AppValidationPipe } from './common/pipes/validation.pipe';
import { getCorsConfig } from './common/middleware/cors.config';
import { loadRuntimeSecrets } from './config/load-secrets';

async function bootstrap() {
  loadRuntimeSecrets();
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Security
  app.enableCors(getCorsConfig());
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
    }),
  );
  app.use(compression());

  // Global pipes, filters, interceptors
  app.useGlobalPipes(AppValidationPipe);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new SanitizeInterceptor(), new TimeoutInterceptor(30000));

  // Swagger (development only)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Mini-SOC API')
      .setDescription('Security Operations Center REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('Auth', 'Authentication & MFA')
      .addTag('Incidents', 'Incident management')
      .addTag('Alerts', 'Security alerts')
      .addTag('IOC', 'Indicators of Compromise')
      .addTag('Assets', 'Asset inventory')
      .addTag('Threat Intelligence', 'Threat intel feeds & lookups')
      .addTag('Reports', 'SOC reports & KPIs')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger documentation available at /api/docs');
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = Number(process.env.API_PORT || process.env.PORT || 4000);
  await app.listen(port);
  logger.log(`🛡️  Mini-SOC API running on port ${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
