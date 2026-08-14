import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { MlEngineService } from './ml-engine.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [IncidentsController],
  providers: [IncidentsService, MlEngineService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
