import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsIP,
  IsMACAddress,
  IsNotEmpty,
  IsArray,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetCriticality } from '@prisma/client';

export class CreateAssetDto {
  @ApiProperty({ example: 'srv-web-01' })
  @IsString()
  @IsNotEmpty()
  hostname: string;

  @ApiPropertyOptional({ example: '10.0.1.50' })
  @IsOptional()
  @IsIP()
  ipAddress?: string;

  @ApiPropertyOptional({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsOptional()
  @IsMACAddress()
  macAddress?: string;

  @ApiPropertyOptional({ example: 'Ubuntu' })
  @IsOptional()
  @IsString()
  os?: string;

  @ApiPropertyOptional({ example: '22.04 LTS' })
  @IsOptional()
  @IsString()
  osVersion?: string;

  @ApiPropertyOptional({ enum: AssetCriticality, default: 'medium' })
  @IsOptional()
  @IsEnum(AssetCriticality)
  criticality?: AssetCriticality;

  @ApiPropertyOptional({ example: 'Jean Dupont' })
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiPropertyOptional({ example: 'IT Infrastructure' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: 'Datacenter Paris' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: ['web', 'production'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: '001' })
  @IsOptional()
  @IsString()
  wazuhAgentId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: { cpu: '8 cores', ram: '32GB' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
