import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IOCType, IOCStatus, IncidentSeverity } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class IocFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: IOCType })
  @IsOptional()
  @IsEnum(IOCType)
  type?: IOCType;

  @ApiPropertyOptional({ enum: IOCStatus })
  @IsOptional()
  @IsEnum(IOCStatus)
  status?: IOCStatus;

  @ApiPropertyOptional({ enum: IncidentSeverity })
  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @ApiPropertyOptional({ description: 'Search by value (partial match)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by source' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'Min confidence score' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minConfidence?: number;

  @ApiPropertyOptional({ description: 'MITRE technique filter' })
  @IsOptional()
  @IsString()
  mitreTechnique?: string;
}
