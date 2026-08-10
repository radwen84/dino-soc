import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SoarService } from './soar.service';
import { SoarController } from './soar.controller';
import { PlaybookEngine } from './playbook-engine.service';
import { AuditModule } from '../audit/audit.module';
import { IocModule } from '../ioc/ioc.module';
import { AssetsModule } from '../assets/assets.module';
import { ThreatIntelModule } from '../threat-intel/threat-intel.module';
import { WazuhModule } from '../wazuh/wazuh.module';

@Module({
  imports: [HttpModule, AuditModule, IocModule, AssetsModule, ThreatIntelModule, WazuhModule],
  controllers: [SoarController],
  providers: [SoarService, PlaybookEngine],
  exports: [SoarService, PlaybookEngine],
})
export class SoarModule {}
