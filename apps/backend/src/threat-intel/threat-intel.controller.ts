import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ThreatIntelService } from './threat-intel.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Threat Intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('threat-intel')
export class ThreatIntelController {
  constructor(private readonly threatIntelService: ThreatIntelService) {}

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
}
