import { IsOptional, IsEnum, IsDateString, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ReportType {
  EXECUTIVE_SUMMARY = 'executive_summary',
  INCIDENT_REPORT = 'incident_report',
  THREAT_LANDSCAPE = 'threat_landscape',
  KPI_METRICS = 'kpi_metrics',
  COMPLIANCE = 'compliance',
  ASSET_INVENTORY = 'asset_inventory',
}

export enum ReportFormat {
  JSON = 'json',
  CSV = 'csv',
  PDF = 'pdf',
}

export enum ReportPeriod {
  LAST_24H = 'last_24h',
  LAST_7D = 'last_7d',
  LAST_30D = 'last_30d',
  LAST_90D = 'last_90d',
  CUSTOM = 'custom',
}

export class ReportFiltersDto {
  @ApiPropertyOptional({ enum: ReportType })
  @IsEnum(ReportType)
  type: ReportType;

  @ApiPropertyOptional({ enum: ReportFormat, default: 'json' })
  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;

  @ApiPropertyOptional({ enum: ReportPeriod, default: 'last_7d' })
  @IsOptional()
  @IsEnum(ReportPeriod)
  period?: ReportPeriod;

  @ApiPropertyOptional({ description: 'Custom start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Custom end date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Incident ID for specific incident report' })
  @IsOptional()
  @IsString()
  incidentId?: string;
}
