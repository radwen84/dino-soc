import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssetFiltersDto } from './dto/asset-filters.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @Roles('admin', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Create a new asset' })
  @ApiResponse({ status: 201, description: 'Asset created successfully' })
  create(@Body() dto: CreateAssetDto, @CurrentUser('id') userId: string) {
    return this.assetsService.create(dto, userId);
  }

  @Get()
  @Roles('admin', 'analyst_l1', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'List all assets with filters' })
  findAll(@Query() filters: AssetFiltersDto) {
    return this.assetsService.findAll(filters);
  }

  @Get('stats')
  @Roles('admin', 'analyst_l1', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Get asset statistics' })
  getStats() {
    return this.assetsService.getStats();
  }

  @Get('search/ip/:ip')
  @Roles('admin', 'analyst_l1', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Find asset by IP address' })
  findByIp(@Param('ip') ip: string) {
    return this.assetsService.findByIp(ip);
  }

  @Get('search/hostname/:hostname')
  @Roles('admin', 'analyst_l1', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Find asset by hostname' })
  findByHostname(@Param('hostname') hostname: string) {
    return this.assetsService.findByHostname(hostname);
  }

  @Get(':id')
  @Roles('admin', 'analyst_l1', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Get asset by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.findOne(id);
  }

  @Put(':id')
  @Roles('admin', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Update an asset' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.assetsService.update(id, dto, userId);
  }

  @Delete(':id')
  @Roles('admin', 'analyst_l3')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an asset' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.assetsService.remove(id, userId);
  }

  @Post('sync-wazuh')
  @Roles('admin')
  @ApiOperation({ summary: 'Trigger manual Wazuh agent sync' })
  syncWazuh() {
    return this.assetsService.syncWithWazuh();
  }
}
