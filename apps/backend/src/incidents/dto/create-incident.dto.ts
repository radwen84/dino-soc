import { IsString, IsEnum, IsOptional, IsArray, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIncidentDto {
  @ApiProperty({ example: 'Brute force SSH detected on web-server-01' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional({ example: 'Multiple failed SSH login attempts from IP 203.0.113.42' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ enum: ['critical', 'high', 'medium', 'low', 'informational'] })
  @IsEnum(['critical', 'high', 'medium', 'low', 'informational'])
  severity!: string;

  @ApiPropertyOptional({ example: 'brute_force' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: ['TA0001'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mitreTactics?: string[];

  @ApiPropertyOptional({ example: ['T1110.001'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mitreTechniques?: string[];

  @ApiPropertyOptional({ example: 'wazuh' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: ['alert-uuid-1', 'alert-uuid-2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceAlertIds?: string[];

  @ApiPropertyOptional({ example: ['ssh', 'brute-force', 'external'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
