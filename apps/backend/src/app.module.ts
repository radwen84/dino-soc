import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

// Core modules
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';

// Security modules
import { IncidentsModule } from './incidents/incidents.module';
import { AlertsModule } from './alerts/alerts.module';
import { IocModule } from './ioc/ioc.module';
import { AssetsModule } from './assets/assets.module';
import { ThreatIntelModule } from './threat-intel/threat-intel.module';
import { ReportsModule } from './reports/reports.module';

// Infrastructure modules
import { OpenSearchModule } from './opensearch/opensearch.module';
import { WazuhModule } from './wazuh/wazuh.module';
import { WebsocketModule } from './websocket/websocket.module';

import configuration from './config/configuration';
import { validate } from './config/env.validation';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      expandVariables: true,
    }),

    // Event system
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),

    // Scheduled tasks
    ScheduleModule.forRoot(),

    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),

    // Core
    PrismaModule,
    AuthModule,
    UsersModule,
    AuditModule,
    HealthModule,

    // Security
    IncidentsModule,
    AlertsModule,
    IocModule,
    AssetsModule,
    ThreatIntelModule,
    ReportsModule,

    // Infrastructure
    OpenSearchModule,
    WazuhModule,
    WebsocketModule,
  ],
})
export class AppModule {}