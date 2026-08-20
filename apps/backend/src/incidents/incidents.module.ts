import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { MlEngineService } from './ml-engine.service';
import { TheHiveService } from './thehive.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [IncidentsController],
  providers: [IncidentsService, MlEngineService, TheHiveService],
  exports: [IncidentsService, TheHiveService],
})
export class IncidentsModule {}
