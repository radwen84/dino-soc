import { IsString, IsEnum, IsOptional, IsArray, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateIncidentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['critical', 'high', 'medium', 'low', 'informational'] })
  @IsOptional()
  @IsEnum(['critical', 'high', 'medium', 'low', 'informational'])
  severity?: string;

  @ApiPropertyOptional({ enum: ['new', 'triaged', 'investigating', 'contained', 'eradicated', 'recovered', 'closed', 'false_positive'] })
  @IsOptional()
  @IsEnum(['new', 'triaged', 'investigating', 'contained', 'eradicated', 'recovered', 'closed', 'false_positive'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mitreTactics?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mitreTechniques?: string[];

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  riskScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessImpact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lessonsLearned?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
