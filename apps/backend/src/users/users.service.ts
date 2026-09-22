import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';

export interface UserPublicProfile {
  id: string;
  email: string;
  name: string;
  roles: string[];
  isActive: boolean;
  mfaEnabled: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface UserSummaryProfile extends UserPublicProfile {
  lastLogin: Date | null;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly SALT_ROUNDS = 12;

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto): Promise<UserPublicProfile> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        roles: dto.roles || ['analyst_l1'],
      },
      select: {
        id: true,
        email: true,
        name: true,
        roles: true,
        isActive: true,
        mfaEnabled: true,
        createdAt: true,
      },
    });

    this.logger.log(`User created: ${user.email}`);
    return user;
  }

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<UserSummaryProfile>> {
    const { skip, limit, sortBy, sortOrder } = pagination;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { [sortBy || 'createdAt']: sortOrder || 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          roles: true,
          isActive: true,
          mfaEnabled: true,
          lastLogin: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: users,
      meta: {
        total,
        page: pagination.page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: pagination.page * limit < total,
        hasPrev: pagination.page > 1,
      },
    };
  }

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserPublicProfile> {
    await this.findById(id);

    const { password, ...rest } = dto;
    const updateData: Prisma.UserUpdateInput = { ...rest };

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        roles: true,
        isActive: true,
        mfaEnabled: true,
        updatedAt: true,
        createdAt: true,
      },
    });
  }

  async deactivate(id: string): Promise<User> {
    await this.findById(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async incrementFailedAttempts(id: string): Promise<number> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: { increment: 1 } },
    });
    return user.failedLoginAttempts;
  }

  async resetFailedAttempts(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  async lockAccount(id: string, lockUntil: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lockedUntil: lockUntil },
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLogin: new Date() },
    });
  }

  async setMfaSecret(id: string, secret: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { mfaSecret: secret },
    });
  }

  async enableMfa(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { mfaEnabled: true },
    });
  }

  async disableMfa(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { mfaEnabled: false, mfaSecret: null },
    });
  }
}
