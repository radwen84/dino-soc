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
import { IocService } from './ioc.service';
import { CreateIocDto } from './dto/create-ioc.dto';
import { UpdateIocDto } from './dto/update-ioc.dto';
import { IocFiltersDto } from './dto/ioc-filters.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('IOC')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ioc')
export class IocController {
  constructor(private readonly iocService: IocService) {}

  @Post()
  @Roles('admin', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Create a new IOC' })
  @ApiResponse({ status: 201, description: 'IOC created successfully' })
  create(@Body() dto: CreateIocDto, @CurrentUser('id') userId: string) {
    return this.iocService.create(dto, userId);
  }

  @Get()
  @Roles('admin', 'analyst_l1', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'List all IOCs with filters' })
  findAll(@Query() filters: IocFiltersDto) {
    return this.iocService.findAll(filters);
  }

  @Get('stats')
  @Roles('admin', 'analyst_l1', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Get IOC statistics' })
  getStats() {
    return this.iocService.getStats();
  }

  @Get('match/:value')
  @Roles('admin', 'analyst_l1', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Match a value against active IOCs' })
  @ApiParam({ name: 'value', description: 'Value to match (IP, domain, hash...)' })
  matchValue(@Param('value') value: string) {
    return this.iocService.matchValue(value);
  }

  @Get(':id')
  @Roles('admin', 'analyst_l1', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Get IOC by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.iocService.findOne(id);
  }

  @Put(':id')
  @Roles('admin', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Update an IOC' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIocDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.iocService.update(id, dto, userId);
  }

  @Delete(':id')
  @Roles('admin', 'analyst_l3')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an IOC' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.iocService.remove(id, userId);
  }

  @Post('bulk-import')
  @Roles('admin', 'analyst_l3')
  @ApiOperation({ summary: 'Bulk import IOCs from threat intel feed' })
  @ApiResponse({ status: 200, description: 'Import results' })
  bulkImport(@Body() iocs: CreateIocDto[], @CurrentUser('id') userId: string) {
    return this.iocService.bulkImport(iocs, userId);
  }
}
