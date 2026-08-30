
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../src/users/users.service';
import { TotpService } from '../../src/auth/mfa/totp.service';
import { AuditService } from '../../src/audit/audit.service';
import { RedisService } from '../../src/redis/redis.service';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;

  const mockUser = {
    id: 'user-uuid',
    email: 'test@minisoc.local',
    name: 'Test User',
    passwordHash: '',
    roles: ['analyst_l1'],
    mfaEnabled: false,
    mfaSecret: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    isActive: true,
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    isLocked: jest.fn().mockResolvedValue(false),
    increment: jest.fn().mockResolvedValue(1),
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('TestPassword123!', 12);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('token') } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('7d') } },
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            updateFailedAttempts: jest.fn(),
            incrementFailedAttempts: jest.fn().mockResolvedValue(1),
            resetFailedAttempts: jest.fn(),
            updateLastLogin: jest.fn(),
            lockAccount: jest.fn(),
          },
        },
        { provide: TotpService, useValue: { verify: jest.fn() } },
        { provide: AuditService, useValue: { log: jest.fn() } },
        // --- Injection du Mock RedisService ---
        { provide: RedisService, useValue: mockRedisService },
        { provide: 'RedisService', useValue: mockRedisService },
        { provide: 'REDIS_CLIENT', useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
  });

  describe('validateUser', () => {
    it('should return user on valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);

      const result = await service.validateUser('test@minisoc.local', 'TestPassword123!', '127.0.0.1');
      expect(result).toBeDefined();
      expect(result.email).toBe('test@minisoc.local');
    });

    it('should throw on invalid password', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);

      await expect(service.validateUser('test@minisoc.local', 'wrong-password', '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw if account is locked', async () => {
      const lockedUser = { ...mockUser, lockedUntil: new Date(Date.now() + 3600000) };
      usersService.findByEmail.mockResolvedValue(lockedUser as any);

      await expect(service.validateUser('test@minisoc.local', 'TestPassword123!', '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return user even if inactive (login handles this check)', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      usersService.findByEmail.mockResolvedValue(inactiveUser as any);

      // validateUser only checks credentials, not active status
      const result = await service.validateUser('test@minisoc.local', 'TestPassword123!', '127.0.0.1');
      expect(result.isActive).toBe(false);
    });
  });
});