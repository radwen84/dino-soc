import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UsersService, UserPublicProfile, UserSummaryProfile } from './users.service'; // 👈 Importer les interfaces/types réels du service
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SOCRole } from '../common/enums/roles.enum';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(SOCRole.ADMIN)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async create(@Body() dto: CreateUserDto): Promise<UserPublicProfile> {
    // 👈 Corrigé
    return this.usersService.create(dto);
  }

  @Get()
  @Roles(SOCRole.ADMIN)
  @ApiOperation({ summary: 'List users with pagination' })
  async findAll(@Query() pagination: PaginationDto): Promise<PaginatedResult<UserSummaryProfile>> {
    // 👈 Corrigé
    return this.usersService.findAll(pagination);
  }

  @Get(':id')
  @Roles(SOCRole.ADMIN)
  @ApiOperation({ summary: 'Get user details by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserPublicProfile> {
    // 👈 Corrigé
    return this.usersService.findById(id);
  }

  @Put(':id')
  @Roles(SOCRole.ADMIN)
  @ApiOperation({ summary: 'Update a user' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserPublicProfile> {
    // 👈 Corrigé
    return this.usersService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @Roles(SOCRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate a user account' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.usersService.deactivate(id);
  }
}
