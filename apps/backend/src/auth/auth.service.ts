import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { TotpService } from './mfa/totp.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../common/decorators/current-user.decorator';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    roles: string[];
  };
}

interface MfaPendingResponse {
  requiresMfa: boolean;
  tempToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCK_DURATION_MINUTES = 30;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly totpService: TotpService,
    private readonly auditService: AuditService,
  ) {}

  async validateUser(email: string, password: string, ip: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Timing attack prevention
      await bcrypt.compare(password, '$2b$10$invalidhashforsecuritypurposesonly1234');
      await this.auditService.log('AUTH_FAILED', { email, ip, reason: 'user_not_found' });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      await this.auditService.log('AUTH_LOCKED', { userId: user.id, ip, remainingMinutes });
      throw new UnauthorizedException(`Account locked. Try again in ${remainingMinutes} minutes.`);
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      const attempts = await this.usersService.incrementFailedAttempts(user.id);
      await this.auditService.log('AUTH_FAILED', { userId: user.id, ip, attempts });

      if (attempts >= this.MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + this.LOCK_DURATION_MINUTES * 60000);
        await this.usersService.lockAccount(user.id, lockUntil);
        await this.auditService.log('AUTH_ACCOUNT_LOCKED', { userId: user.id, ip, lockUntil });
        throw new UnauthorizedException(
          `Account locked for ${this.LOCK_DURATION_MINUTES} minutes due to too many failed attempts.`,
        );
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful validation
    if (user.failedLoginAttempts > 0) {
      await this.usersService.resetFailedAttempts(user.id);
    }

    return user;
  }

  async login(
    user: any,
    ip: string,
    totpToken?: string,
  ): Promise<LoginResponse | MfaPendingResponse> {
    // If MFA is enabled, verify TOTP
    if (user.mfaEnabled) {
      if (!totpToken) {
        const tempToken = this.jwtService.sign(
          { sub: user.id, type: 'mfa_pending' },
          { expiresIn: '5m' },
        );
        return { requiresMfa: true, tempToken };
      }

      const isValidTotp = this.totpService.verifyToken(user.mfaSecret, totpToken);
      if (!isValidTotp) {
        await this.auditService.log('MFA_FAILED', { userId: user.id, ip });
        throw new UnauthorizedException('Invalid MFA token');
      }
    }

    // Generate tokens
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );

    // Update last login
    await this.usersService.updateLastLogin(user.id);
    await this.auditService.log('AUTH_SUCCESS', { userId: user.id, ip });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
      },
    };
  }

  async verifyMfa(tempToken: string, totpToken: string, ip: string): Promise<LoginResponse> {
    try {
      const payload = this.jwtService.verify(tempToken);
      if (payload.type !== 'mfa_pending') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException('User not found');

      const isValid = this.totpService.verifyToken(user.mfaSecret, totpToken);
      if (!isValid) {
        await this.auditService.log('MFA_FAILED', { userId: user.id, ip });
        throw new UnauthorizedException('Invalid MFA token');
      }

      return (await this.login({ ...user, mfaEnabled: false }, ip)) as LoginResponse;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      const newPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: user.id,
        email: user.email,
        roles: user.roles,
      };

      return {
        accessToken: this.jwtService.sign(newPayload),
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async setupMfa(userId: string): Promise<{ otpauthUrl: string; qrCode: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    const { otpauthUrl, base32 } = this.totpService.generateSecret(user.email);
    const qrCode = await this.totpService.generateQRCode(otpauthUrl);

    // Store secret temporarily (not enabled until verified)
    await this.usersService.setMfaSecret(userId, base32);

    return { otpauthUrl, qrCode };
  }

  async enableMfa(userId: string, totpToken: string): Promise<{ success: boolean }> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA setup not initiated');
    }

    const isValid = this.totpService.verifyToken(user.mfaSecret, totpToken);
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP token. Please try again.');
    }

    await this.usersService.enableMfa(userId);
    await this.auditService.log('MFA_ENABLED', { userId });

    return { success: true };
  }

  async disableMfa(userId: string, password: string): Promise<{ success: boolean }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.usersService.disableMfa(userId);
    await this.auditService.log('MFA_DISABLED', { userId });

    return { success: true };
  }
}
