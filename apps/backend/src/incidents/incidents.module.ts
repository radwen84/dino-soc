import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { MlEngineService } from './ml-engine.service';
import { TheHiveService } from './thehive.service';
import { AuditModule } from '../audit/audit.module';
import { IocModule } from '../ioc/ioc.module';

@Module({
  imports: [
    AuditModule, 
    HttpModule, 
    IocModule,
  ],
  controllers: [IncidentsController],
  providers: [
    IncidentsService, 
    MlEngineService, 
    TheHiveService,
  ],
  exports: [IncidentsService, TheHiveService],
})
export class IncidentsModule {}
