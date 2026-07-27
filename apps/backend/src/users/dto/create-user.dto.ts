import { IsEmail, IsString, MinLength, MaxLength, IsArray, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'analyst@minisoc.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Jean Dupont' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'SecureP@ssw0rd!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: ['analyst_l1'], enum: ['admin', 'analyst_l1', 'analyst_l2', 'analyst_l3', 'threat_hunter', 'incident_responder', 'readonly'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];
}
