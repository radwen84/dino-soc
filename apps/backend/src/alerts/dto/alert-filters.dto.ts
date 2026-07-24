import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class AlertFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['new', 'acknowledged', 'escalated', 'resolved', 'false_positive'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ minimum: 1, description: 'Minimum alert level' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  level?: number;

  @ApiPropertyOptional({ enum: ['wazuh', 'suricata', 'falco', 'sigma'] })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: '192.168.1.100' })
  @IsOptional()
  @IsString()
  srcIp?: string;

  @ApiPropertyOptional({ example: '100001' })
  @IsOptional()
  @IsString()
  ruleId?: string;

  @ApiPropertyOptional({ example: 'T1110.001' })
  @IsOptional()
  @IsString()
  mitreTechnique?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  incidentId?: string;
}
