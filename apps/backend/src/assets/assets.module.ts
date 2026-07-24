import { Module } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { AuditModule } from '../audit/audit.module';
import { WazuhModule } from '../wazuh/wazuh.module';

@Module({
  imports: [AuditModule, WazuhModule],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
