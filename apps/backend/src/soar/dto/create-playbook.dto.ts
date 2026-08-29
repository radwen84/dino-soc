import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsObject,
  IsDefined,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PlaybookActionType {
  ENRICH_ALERT = 'enrich_alert',
  LOOKUP_IOC = 'lookup_ioc',
  ISOLATE_HOST = 'isolate_host',
  BLOCK_IP = 'block_ip',
  REVOKE_SESSIONS = 'revoke_sessions',
  CREATE_INCIDENT = 'create_incident',
  NOTIFY = 'notify',
  ESCALATE = 'escalate',
  TAG_ASSET = 'tag_asset',
  WEBHOOK = 'webhook',
  DISABLE_USER = 'disable_user',
  QUARANTINE_FILE = 'quarantine_file',
}

export enum PlaybookRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ConditionOperator {
  EQ = 'eq',
  GT = 'gt',
  LT = 'lt',
  GTE = 'gte',
  LTE = 'lte',
  CONTAINS = 'contains',
  IN = 'in',
  REGEX = 'regex',
  NOT_EQ = 'not_eq',
}

export class PlaybookConditionDto {
  @ApiProperty({ description: 'Field path to evaluate (supports dot notation)' })
  @IsString()
  @IsNotEmpty()
  field!: string;

  @ApiProperty({ enum: ConditionOperator })
  @IsEnum(ConditionOperator)
  operator!: ConditionOperator;

  // 💡 FIX 1: @IsDefined() indique à class-validator que cette propriété est reconnue
  @ApiProperty({ description: 'Value to compare against' })
  @IsDefined()
  value!: any;
}

export class RetryPolicyDto {
  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  maxRetries?: number = 3;

  @ApiPropertyOptional({ default: 1000, description: 'Delay between retries in ms' })
  @IsOptional()
  @IsNumber()
  delayMs?: number = 1000;

  @ApiPropertyOptional({ default: true, description: 'Use exponential backoff' })
  @IsOptional()
  @IsBoolean()
  exponentialBackoff?: boolean = true;
}

export class PlaybookActionDto {
  @ApiProperty({ description: 'Unique action identifier within the playbook' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ description: 'Human-readable action name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: PlaybookActionType })
  @IsEnum(PlaybookActionType)
  type!: PlaybookActionType;

  // 💡 FIX 2: Ajout de @IsObject() pour autoriser la validation de dictionnaires Key/Value
  @ApiPropertyOptional({ description: 'Action parameters (supports {{variable}} interpolation)' })
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;

  @ApiPropertyOptional({ enum: PlaybookRiskLevel, default: PlaybookRiskLevel.LOW })
  @IsOptional()
  @IsEnum(PlaybookRiskLevel)
  riskLevel?: PlaybookRiskLevel = PlaybookRiskLevel.LOW;

  @ApiPropertyOptional({ default: 30000, description: 'Action timeout in ms' })
  @IsOptional()
  @IsNumber()
  timeoutMs?: number = 30000;

  @ApiPropertyOptional({ type: RetryPolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RetryPolicyDto)
  retryPolicy?: RetryPolicyDto;

  @ApiPropertyOptional({ description: 'Requires human approval before execution' })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean = false;

  @ApiPropertyOptional({
    description: 'Action IDs that must complete before this one (DAG dependencies)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependsOn?: string[];

  @ApiPropertyOptional({ description: 'Rollback action ID to execute on failure' })
  @IsOptional()
  @IsString()
  rollbackActionId?: string;
}

export class TriggerConditionsDto {
  @ApiProperty({ description: 'Event type that triggers this playbook', example: 'alert' })
  @IsString()
  @IsNotEmpty()
  triggerType!: string;

  @ApiPropertyOptional({ type: [PlaybookConditionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlaybookConditionDto)
  rules?: PlaybookConditionDto[];
}

export class CreatePlaybookDto {
  @ApiProperty({ description: 'Playbook name', example: 'Block malicious IPs' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Playbook description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: TriggerConditionsDto })
  @ValidateNested()
  @Type(() => TriggerConditionsDto)
  triggerConditions!: TriggerConditionsDto;

  @ApiProperty({ type: [PlaybookActionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlaybookActionDto)
  actions!: PlaybookActionDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({ description: 'Tags for categorization' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class ExecutePlaybookDto {
  @ApiProperty({ description: 'Test data to trigger the playbook with' })
  @IsObject()
  testData!: Record<string, any>;

  @ApiPropertyOptional({ default: false, description: 'Dry-run mode (no real actions executed)' })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean = false;
}