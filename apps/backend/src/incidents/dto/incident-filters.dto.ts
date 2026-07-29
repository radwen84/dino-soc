import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class IncidentFiltersDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: [
      'new',
      'triaged',
      'investigating',
      'contained',
      'eradicated',
      'recovered',
      'closed',
      'false_positive',
    ],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low', 'informational'] })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'T1110.001' })
  @IsOptional()
  @IsString()
  mitreTechnique?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
