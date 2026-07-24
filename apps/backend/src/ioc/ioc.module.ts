import { Module } from '@nestjs/common';
import { IocService } from './ioc.service';
import { IocController } from './ioc.controller';
import { AuditModule } from '../audit/audit.module';
import { OpenSearchModule } from '../opensearch/opensearch.module';

@Module({
  imports: [AuditModule, OpenSearchModule],
  controllers: [IocController],
  providers: [IocService],
  exports: [IocService],
})
export class IocModule {}
