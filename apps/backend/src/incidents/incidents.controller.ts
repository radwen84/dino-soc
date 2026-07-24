import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { SOCRole } from '../common/enums/roles.enum';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { IncidentFiltersDto } from './dto/incident-filters.dto';

@ApiTags('Incidents')
@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @Roles(SOCRole.ANALYST_L1, SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.ADMIN)
  @ApiOperation({ summary: 'Create a new incident' })
  async create(@Body() dto: CreateIncidentDto, @CurrentUser() user: JwtPayload) {
    return this.incidentsService.create(dto, user.sub);
  }

  @Get()
  @Roles(SOCRole.ANALYST_L1, SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.ADMIN, SOCRole.READONLY, SOCRole.THREAT_HUNTER, SOCRole.INCIDENT_RESPONDER)
  @ApiOperation({ summary: 'List incidents with filters' })
  async findAll(@Query() filters: IncidentFiltersDto) {
    return this.incidentsService.findAll(filters);
  }

  @Get('statistics')
  @Roles(SOCRole.ANALYST_L1, SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.ADMIN)
  @ApiOperation({ summary: 'Get incident statistics for dashboard' })
  async getStatistics() {
    return this.incidentsService.getStatistics();
  }

  @Get(':id')
  @Roles(SOCRole.ANALYST_L1, SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.ADMIN, SOCRole.READONLY)
  @ApiOperation({ summary: 'Get incident details' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.incidentsService.findById(id);
  }

  @Patch(':id')
  @Roles(SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.ADMIN)
  @ApiOperation({ summary: 'Update an incident' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIncidentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.incidentsService.update(id, dto, user.sub);
  }

  @Patch(':id/assign')
  @Roles(SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.ADMIN)
  @ApiOperation({ summary: 'Assign incident to an analyst' })
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('assignToUserId', ParseUUIDPipe) assignToUserId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.incidentsService.assign(id, assignToUserId, user.sub);
  }

  @Patch(':id/escalate')
  @Roles(SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.ADMIN)
  @ApiOperation({ summary: 'Escalate incident to higher level' })
  async escalate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('escalateToUserId', ParseUUIDPipe) escalateToUserId: string,
    @Body('reason') reason: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.incidentsService.escalate(id, escalateToUserId, reason, user.sub);
  }

  @Patch(':id/close')
  @Roles(SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.ADMIN)
  @ApiOperation({ summary: 'Close an incident' })
  async close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('lessonsLearned') lessonsLearned: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.incidentsService.close(id, lessonsLearned, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(SOCRole.ADMIN)
  @ApiOperation({ summary: 'Soft delete an incident (Admin only)' })
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    await this.incidentsService.softDelete(id, user.sub);
  }
}
