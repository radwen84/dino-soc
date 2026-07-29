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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SoarService } from './soar.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('SOAR')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('soar')
export class SoarController {
  constructor(private readonly soarService: SoarService) {}

  @Get('playbooks')
  @Roles('admin', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'List all playbooks' })
  getPlaybooks() {
    return this.soarService.getPlaybooks();
  }

  @Get('playbooks/defaults')
  @Roles('admin')
  @ApiOperation({ summary: 'Get default playbook templates' })
  getDefaults() {
    return this.soarService.getDefaultPlaybooks();
  }

  @Get('playbooks/:id')
  @Roles('admin', 'analyst_l2', 'analyst_l3')
  getPlaybook(@Param('id', ParseUUIDPipe) id: string) {
    return this.soarService.getPlaybook(id);
  }

  @Post('playbooks')
  @Roles('admin', 'analyst_l3')
  @ApiOperation({ summary: 'Create a new playbook' })
  create(@Body() data: any, @CurrentUser('id') userId: string) {
    return this.soarService.createPlaybook(data, userId);
  }

  @Patch('playbooks/:id/toggle')
  @Roles('admin', 'analyst_l3')
  @ApiOperation({ summary: 'Enable/disable a playbook' })
  toggle(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.soarService.togglePlaybook(id, userId);
  }

  @Post('playbooks/:id/execute')
  @Roles('admin', 'analyst_l3')
  @ApiOperation({ summary: 'Manually execute a playbook with test data' })
  execute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() testData: any,
    @CurrentUser('id') userId: string,
  ) {
    return this.soarService.executeManually(id, testData, userId);
  }
}
