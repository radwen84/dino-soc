import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ThreatIntelService } from './threat-intel.service';
import { StixTaxiiService } from './feeds/stix-taxii.service';
import { IocService } from '../ioc/ioc.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Threat Intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('threat-intel')
export class ThreatIntelController {
  constructor(
    private readonly threatIntelService: ThreatIntelService,
    private readonly stixTaxii: StixTaxiiService,
    private readonly iocService: IocService,
  ) {}

  @Get('lookup/:value')
  @Roles('admin', 'analyst_l1', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Lookup threat intelligence for a value' })
  @ApiParam({ name: 'value', description: 'IP, domain, or hash to lookup' })
  @ApiResponse({ status: 200, description: 'Threat intelligence result' })
  lookup(@Param('value') value: string) {
    return this.threatIntelService.lookup(value);
  }

  @Get('feeds/status')
  @Roles('admin', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Get threat intel feeds status' })
  getFeedStatus() {
    return this.threatIntelService.getFeedStatus();
  }

  @Post('feeds/sync')
  @Roles('admin')
  @ApiOperation({ summary: 'Trigger manual feed synchronization' })
  @ApiResponse({ status: 200, description: 'Feed sync results' })
  syncFeeds() {
    return this.threatIntelService.syncFeeds();
  }

  // ─────────────────────────────────────────────────────────
  // STIX/TAXII Endpoints
  // ─────────────────────────────────────────────────────────

  @Post('taxii/ingest')
  @Roles('admin', 'analyst_l3')
  @ApiOperation({ summary: 'Ingest IOCs from a TAXII 2.1 feed' })
  @ApiResponse({ status: 200, description: 'Ingestion results' })
  async ingestTaxiiFeed(
    @Body()
    config: {
      serverUrl: string;
      apiRoot: string;
      collectionId: string;
      username?: string;
      password?: string;
      addedAfter?: string;
    },
    @CurrentUser('id') userId: string,
  ) {
    const iocs = await this.stixTaxii.ingestFromTaxiiFeed({
      serverUrl: config.serverUrl,
      apiRoot: config.apiRoot,
      collectionId: config.collectionId,
      credentials: config.username
        ? { user: config.username, password: config.password }
        : undefined,
      addedAfter: config.addedAfter,
    });

    if (iocs.length === 0) {
      return { ingested: 0, message: 'No new indicators found' };
    }

    const result = await this.iocService.bulkImport(iocs, userId);
    return { ...result, source: 'TAXII', totalParsed: iocs.length };
  }

  @Post('taxii/collections')
  @Roles('admin', 'analyst_l3')
  @ApiOperation({ summary: 'List collections from a TAXII server' })
  async listTaxiiCollections(
    @Body() config: { serverUrl: string; apiRoot: string; username?: string; password?: string },
  ) {
    return this.stixTaxii.listCollections(
      config.serverUrl,
      config.apiRoot,
      config.username ? { user: config.username, password: config.password } : undefined,
    );
  }

  @Post('stix/export')
  @Roles('admin', 'analyst_l3')
  @ApiOperation({ summary: 'Export local IOCs as a STIX 2.x bundle' })
  @ApiResponse({ status: 200, description: 'STIX bundle' })
  async exportStixBundle() {
    const iocs = await this.iocService.findAll({
      status: 'active',
      page: 1,
      limit: 500,
      skip: 0,
    } as any);

    const bundle = this.stixTaxii.generateStixBundle(
      iocs.data.map((ioc: any) => ({
        type: ioc.type,
        value: ioc.value,
        description: ioc.description,
        confidence: ioc.confidence,
        severity: ioc.severity,
        mitreTechniques: ioc.mitreTechniques,
      })),
      'Mini-SOC',
    );

    return bundle;
  }
}
