import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { TotpService } from './mfa/totp.service';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../redis/redis.service';
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
  private readonly REFRESH_TOKEN_TTL_SECONDS: number;
  private readonly TOTP_REPLAY_TTL_SECONDS = 90; // TOTP window ±30s → 90s is safe

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly totpService: TotpService,
    private readonly auditService: AuditService,
    private readonly redisService: RedisService,
  ) {
    // Parse refresh token expiry (e.g. "7d" → seconds)
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    this.REFRESH_TOKEN_TTL_SECONDS = this.parseDurationToSeconds(refreshExpiresIn);
  }

  private parseDurationToSeconds(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 86400; // default 7 days
    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 7 * 86400;
    }
  }

  // ============================================
  // TOTP Anti-Replay (Phase 2.3)
  // ============================================

  private async checkTotpReplay(userId: string, token: string): Promise<boolean> {
    const key = `totp:used:${userId}:${token}`;
    const exists = await this.redisService.exists(key);
    if (exists) return true; // replay detected
    // Mark token as used with TTL
    await this.redisService.set(key, '1', this.TOTP_REPLAY_TTL_SECONDS);
    return false;
  }

  // ============================================
  // Refresh Token Rotation + Revocation (Phase 2.1)
  // ============================================

  private async issueRefreshToken(userId: string): Promise<string> {
    const jti = uuidv4();
    const refreshToken = this.jwtService.sign(
      { sub: userId, type: 'refresh', jti },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );
    // Store jti in Redis with TTL — presence = token is valid
    await this.redisService.set(
      `refresh:${jti}`,
      userId,
      this.REFRESH_TOKEN_TTL_SECONDS,
    );
    return refreshToken;
  }

  private async revokeRefreshToken(jti: string): Promise<void> {
    await this.redisService.del(`refresh:${jti}`);
  }

  // ============================================
  // AUTH FLOW
  // ============================================

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

      // Phase 2.3: Anti-replay check
      const isReplay = await this.checkTotpReplay(user.id, totpToken);
      if (isReplay) {
        await this.auditService.log('MFA_REPLAY_DETECTED', { userId: user.id, ip });
        throw new UnauthorizedException('MFA token already used. Please wait for a new code.');
      }

      const isValidTotp = this.totpService.verifyToken(user.mfaSecret, totpToken);
      if (!isValidTotp) {
        // Phase 2.4: MFA failures count toward account lockout
        const attempts = await this.usersService.incrementFailedAttempts(user.id);
        await this.auditService.log('MFA_FAILED', { userId: user.id, ip, attempts });

        if (attempts >= this.MAX_FAILED_ATTEMPTS) {
          const lockUntil = new Date(Date.now() + this.LOCK_DURATION_MINUTES * 60000);
          await this.usersService.lockAccount(user.id, lockUntil);
          await this.auditService.log('AUTH_ACCOUNT_LOCKED', { userId: user.id, ip, lockUntil, reason: 'mfa_failures' });
          throw new UnauthorizedException(
            `Account locked for ${this.LOCK_DURATION_MINUTES} minutes due to too many failed attempts.`,
          );
        }

        throw new UnauthorizedException('Invalid MFA token');
      }
    }

    // Generate tokens — Phase 2.1: refresh token with jti stored in Redis
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };

    const accessToken = this.jwtService.sign(payload, {
      issuer: 'minisoc',
      audience: 'minisoc-api',
    });

    const refreshToken = await this.issueRefreshToken(user.id);

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

      // Phase 2.3: Anti-replay check
      const isReplay = await this.checkTotpReplay(user.id, totpToken);
      if (isReplay) {
        await this.auditService.log('MFA_REPLAY_DETECTED', { userId: user.id, ip });
        throw new UnauthorizedException('MFA token already used. Please wait for a new code.');
      }

      const isValid = this.totpService.verifyToken(user.mfaSecret, totpToken);
      if (!isValid) {
        // Phase 2.4: MFA failures count toward lockout
        const attempts = await this.usersService.incrementFailedAttempts(user.id);
        await this.auditService.log('MFA_FAILED', { userId: user.id, ip, attempts });

        if (attempts >= this.MAX_FAILED_ATTEMPTS) {
          const lockUntil = new Date(Date.now() + this.LOCK_DURATION_MINUTES * 60000);
          await this.usersService.lockAccount(user.id, lockUntil);
        }

        throw new UnauthorizedException('Invalid MFA token');
      }

      // Reset failed attempts on success
      if (user.failedLoginAttempts > 0) {
        await this.usersService.resetFailedAttempts(user.id);
      }

      return (await this.login({ ...user, mfaEnabled: false }, ip)) as LoginResponse;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  // Phase 2.1: Refresh with rotation — old token is revoked, new one issued
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      if (payload.type !== 'refresh' || !payload.jti) {
        throw new UnauthorizedException('Invalid token type');
      }

      // Check if token is still valid in Redis (not revoked/already used)
      const storedUserId = await this.redisService.get(`refresh:${payload.jti}`);
      if (!storedUserId) {
        // Token was already used or revoked — possible token theft
        this.logger.warn(`Refresh token reuse detected for user ${payload.sub}, jti: ${payload.jti}`);
        await this.auditService.log('REFRESH_TOKEN_REUSE', { userId: payload.sub, jti: payload.jti });
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      // Revoke old token
      await this.revokeRefreshToken(payload.jti);

      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      const newPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: user.id,
        email: user.email,
        roles: user.roles,
      };

      // Issue new rotated refresh token
      const newRefreshToken = await this.issueRefreshToken(user.id);

      return {
        accessToken: this.jwtService.sign(newPayload, {
          issuer: 'minisoc',
          audience: 'minisoc-api',
        }),
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  // Phase 2.2: Real logout — revoke refresh token in Redis
  async logout(refreshToken: string): Promise<{ success: boolean }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      if (payload.jti) {
        await this.revokeRefreshToken(payload.jti);
      }

      await this.auditService.log('AUTH_LOGOUT', { userId: payload.sub });
    } catch {
      // Token may already be expired — still consider logout successful
    }

    return { success: true };
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
