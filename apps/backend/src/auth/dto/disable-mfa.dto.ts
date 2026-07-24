import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DisableMfaDto {
  @ApiProperty({ description: 'Current password to confirm MFA disable' })
  @IsString()
  @MinLength(8)
  password: string;
}
