import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ThreatIntelService } from './threat-intel.service';
import { ThreatIntelController } from './threat-intel.controller';
import { IocModule } from '../ioc/ioc.module';
import { AuditModule } from '../audit/audit.module';
import { OtxFeedService } from './feeds/otx-feed.service';
import { AbuseIpDbService } from './feeds/abuseipdb.service';
import { MispFeedService } from './feeds/misp-feed.service';
import { StixTaxiiService } from './feeds/stix-taxii.service';
import { PluginEngineClient } from './plugin-engine.client';

@Module({
  imports: [HttpModule.register({ timeout: 10000, maxRedirects: 3 }), IocModule, AuditModule],
  controllers: [ThreatIntelController],
  providers: [
    ThreatIntelService,
    OtxFeedService,
    AbuseIpDbService,
    MispFeedService,
    StixTaxiiService,
    PluginEngineClient,
  ],
  exports: [ThreatIntelService, StixTaxiiService, PluginEngineClient],
})
export class ThreatIntelModule {}
