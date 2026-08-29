import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IOCType, IOCStatus, IncidentSeverity } from '@prisma/client';

export class CreateIocDto {
  @ApiProperty({ enum: IOCType, example: 'ip' })
  @IsEnum(IOCType)
  type!: IOCType;

  @ApiProperty({ example: '192.168.1.100' })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiPropertyOptional({ example: 'C2 server observed in APT28 campaign' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: IOCStatus, default: IOCStatus.active })
  @IsOptional()
  @IsEnum(IOCStatus)
  status?: IOCStatus = IOCStatus.active;

  // 💡 Correction majeure : @Type() force la conversion en nombre avant la validation IsInt
  @ApiProperty({ example: 75, description: 'Confidence score 0-100' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  confidence!: number;

  @ApiPropertyOptional({ enum: IncidentSeverity, default: IncidentSeverity.medium })
  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity = IncidentSeverity.medium;

  @ApiPropertyOptional({ example: 'AlienVault OTX' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: 'https://otx.alienvault.com/pulse/abc123' })
  @IsOptional()
  @IsString()
  sourceReference?: string;

  @ApiPropertyOptional({ example: ['T1071', 'T1059'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mitreTechniques?: string[];

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: ['apt28', 'c2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: ['incident-uuid-1'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedIncidents?: string[];
}