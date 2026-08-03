import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SOCRole } from '../common/enums/roles.enum';
import { AlertsService } from './alerts.service';
import { AlertFiltersDto } from './dto/alert-filters.dto';

@ApiTags('Alerts')
@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @Roles(
    SOCRole.ANALYST_L1,
    SOCRole.ANALYST_L2,
    SOCRole.ANALYST_L3,
    SOCRole.ADMIN,
    SOCRole.READONLY,
  )
  @ApiOperation({ summary: 'List alerts with filters' })
  async findAll(@Query() filters: AlertFiltersDto): Promise<PaginatedResult<any>> {
    return this.alertsService.findAll(filters);
  }

  @Get('critical')
  @Roles(SOCRole.ANALYST_L1, SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.ADMIN)
  @ApiOperation({ summary: 'Get recent critical alerts' })
  async getRecentCritical(): Promise<any[]> {
    return this.alertsService.getRecentCritical();
  }

  @Get('timeline')
  @Roles(SOCRole.ANALYST_L1, SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.ADMIN)
  @ApiOperation({ summary: 'Get alert timeline (last 24h)' })
  async getTimeline(@Query('hours') hours?: number): Promise<any[]> {
    return this.alertsService.getAlertTimeline(hours || 24);
  }

  @Get('search')
  @Roles(SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.THREAT_HUNTER, SOCRole.ADMIN)
  @ApiOperation({ summary: 'Search alerts in OpenSearch' })
  async search(
    @Query('q') query: string,
    @Query('from') from?: number,
    @Query('size') size?: number,
  ): Promise<any> {
    return this.alertsService.searchInOpenSearch(query, from, size);
  }

  @Get(':id')
  @Roles(
    SOCRole.ANALYST_L1,
    SOCRole.ANALYST_L2,
    SOCRole.ANALYST_L3,
    SOCRole.ADMIN,
    SOCRole.READONLY,
  )
  @ApiOperation({ summary: 'Get alert details' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
    return this.alertsService.findById(id);
  }

  @Patch(':id/status')
  @Roles(SOCRole.ANALYST_L1, SOCRole.ANALYST_L2, SOCRole.ADMIN)
  @ApiOperation({ summary: 'Update alert status' })
  async updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body('status') status: string): Promise<any> {
    return this.alertsService.updateStatus(id, status);
  }

  @Patch('bulk/status')
  @Roles(SOCRole.ANALYST_L2, SOCRole.ADMIN)
  @ApiOperation({ summary: 'Bulk update alert status' })
  async bulkUpdateStatus(@Body('ids') ids: string[], @Body('status') status: string): Promise<any> {
    return this.alertsService.bulkUpdateStatus(ids, status);
  }

  @Patch('bulk/link-incident')
  @Roles(SOCRole.ANALYST_L1, SOCRole.ANALYST_L2, SOCRole.ADMIN)
  @ApiOperation({ summary: 'Link alerts to an incident' })
  async linkToIncident(
    @Body('alertIds') alertIds: string[],
    @Body('incidentId') incidentId: string,
  ): Promise<any> {
    return this.alertsService.linkToIncident(alertIds, incidentId);
  }
}
