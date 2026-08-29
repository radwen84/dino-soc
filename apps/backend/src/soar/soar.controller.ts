import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SoarService } from './soar.service';
import { PlaybookEngine } from './playbook-engine.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreatePlaybookDto, ExecutePlaybookDto } from './dto/create-playbook.dto';
import { ApprovalDecisionDto } from './dto/approval.dto';

@ApiTags('Playbooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(['playbooks', 'soar/playbooks'])
export class SoarController {
  constructor(
    private readonly soarService: SoarService,
    private readonly playbookEngine: PlaybookEngine,
  ) {}

  @Get()
  @Roles('admin', 'analyst_l2', 'analyst_l3', 'ADMIN')
  @ApiOperation({ summary: 'List all playbooks' })
  getPlaybooks() {
    return this.soarService.getPlaybooks();
  }

  @Get('defaults')
  @Roles('admin', 'ADMIN')
  @ApiOperation({ summary: 'Get default playbook templates' })
  getDefaults() {
    return this.soarService.getDefaultPlaybooks();
  }

  // --- ROUTES STATIQUES D'APPROBATION PLACÉES AVANT :id ---
  @Get('approvals/pending')
  @Roles('admin', 'analyst_l3', 'incident_responder', 'ADMIN')
  @ApiOperation({ summary: 'List pending approval requests' })
  getPendingApprovals() {
    return this.playbookEngine.getPendingApprovals();
  }

  @Post('approvals/:id/decide')
  @Roles('admin', 'analyst_l3', 'incident_responder', 'ADMIN')
  @ApiOperation({ summary: 'Approve or reject a pending SOAR action' })
  @ApiResponse({ status: 200, description: 'Decision recorded' })
  processApproval(
    @Param('id') approvalId: string,
    @Body() dto: ApprovalDecisionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.playbookEngine.processApproval(approvalId, dto.decision, userId, dto.reason);
  }

  // --- ROUTE DYNAMIQUE :id (DOIT ÊTRE APRÈS LES ROUTES STATIQUES) ---
  @Get(':id')
  @Roles('admin', 'analyst_l2', 'analyst_l3', 'ADMIN')
  getPlaybook(@Param('id', ParseUUIDPipe) id: string) {
    return this.soarService.getPlaybook(id);
  }

  @Post()
  @Roles('admin', 'analyst_l3', 'ADMIN')
  @ApiOperation({ summary: 'Create a new playbook' })
  @ApiResponse({ status: 201, description: 'Playbook created successfully' })
  create(@Body() dto: CreatePlaybookDto, @CurrentUser('id') userId: string) {
    return this.soarService.createPlaybook(dto, userId);
  }

  @Patch(':id/toggle')
  @Roles('admin', 'analyst_l3', 'ADMIN')
  @ApiOperation({ summary: 'Enable/disable a playbook' })
  toggle(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.soarService.togglePlaybook(id, userId);
  }

  @Post(':id/execute')
  @Roles('admin', 'analyst_l3', 'ADMIN')
  @ApiOperation({ summary: 'Manually execute a playbook (supports dry-run)' })
  @ApiResponse({ status: 200, description: 'Playbook execution result' })
  execute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExecutePlaybookDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.soarService.executeManually(id, dto, userId);
  }
}