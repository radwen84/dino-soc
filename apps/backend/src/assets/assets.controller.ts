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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Asset } from '@prisma/client';
import { AssetsService, AssetStats } from './assets.service'; // 👈 Import de AssetStats
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssetFiltersDto } from './dto/asset-filters.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginatedResult } from '../common/dto/pagination.dto';

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
  async create(@Body() dto: CreateAssetDto, @CurrentUser('id') userId: string): Promise<Asset> {
    return this.assetsService.create(dto, userId);
  }

  @Get()
  @Roles('admin', 'analyst_l1', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'List all assets with filters' })
  async findAll(@Query() filters: AssetFiltersDto): Promise<PaginatedResult<Asset>> {
    return this.assetsService.findAll(filters);
  }

  @Get('stats')
  @Roles('admin', 'analyst_l1', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Get asset statistics' })
  async getStats(): Promise<AssetStats> {
    // 👈 Typage aligné sur AssetStats
    return this.assetsService.getStats();
  }

  @Get('search/ip/:ip')
  @Roles('admin', 'analyst_l1', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Find asset by IP address' })
  async findByIp(@Param('ip') ip: string): Promise<Asset | null> {
    return this.assetsService.findByIp(ip);
  }

  @Get('search/hostname/:hostname')
  @Roles('admin', 'analyst_l1', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Find asset by hostname' })
  async findByHostname(@Param('hostname') hostname: string): Promise<Asset | null> {
    return this.assetsService.findByHostname(hostname);
  }

  @Get(':id')
  @Roles('admin', 'analyst_l1', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Get asset by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Asset> {
    return this.assetsService.findOne(id);
  }

  @Put(':id')
  @Roles('admin', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Update an asset' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetDto,
    @CurrentUser('id') userId: string,
  ): Promise<Asset> {
    return this.assetsService.update(id, dto, userId);
  }

  @Delete(':id')
  @Roles('admin', 'analyst_l3')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an asset' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<Asset> {
    return this.assetsService.remove(id, userId);
  }

  @Post('sync-wazuh')
  @Roles('admin')
  @ApiOperation({ summary: 'Trigger manual Wazuh agent sync' })
  async syncWazuh(): Promise<void> {
    return this.assetsService.syncWithWazuh();
  }
}
