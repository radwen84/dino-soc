import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ApprovalStatus {
  APPROVAL_REQUIRED = 'approval_required',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export class ApprovalDecisionDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsEnum({ approved: 'approved', rejected: 'rejected' })
  decision: 'approved' | 'rejected';

  @ApiPropertyOptional({ description: 'Reason for the decision' })
  @IsOptional()
  @IsString()
  reason?: string;
}
