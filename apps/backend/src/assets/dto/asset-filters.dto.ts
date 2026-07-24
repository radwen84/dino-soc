import { IsOptional, IsEnum, IsString, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { AssetCriticality } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class AssetFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: AssetCriticality })
  @IsOptional()
  @IsEnum(AssetCriticality)
  criticality?: AssetCriticality;

  @ApiPropertyOptional({ description: 'Search by hostname or IP' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by OS' })
  @IsOptional()
  @IsString()
  os?: string;

  @ApiPropertyOptional({ description: 'Filter by department' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Filter by location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Filter active/inactive assets' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;
}
