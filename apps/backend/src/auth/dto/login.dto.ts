import { IsEmail, IsString, MinLength, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'analyst@minisoc.local' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecureP@ssw0rd!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: '123456', description: 'TOTP token if MFA enabled' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpToken?: string;
}
