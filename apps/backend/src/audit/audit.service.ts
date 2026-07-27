import { Prisma } from '@prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(action: string, details?: Record<string, unknown>): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          details: (details || {}) as Prisma.InputJsonValue,
          userId: details?.userId as string | undefined,
          resourceType: details?.resourceType as string | undefined,
          resourceId: details?.resourceId as string | undefined,
          ipAddress: details?.ip as string | undefined,
        },
      });
    } catch (error) {
      // Never let audit logging break the main flow
      this.logger.error(`Failed to write audit log: ${action}`, error);
    }
  }

  async logWithContext(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          details: (entry.details || {}) as Prisma.InputJsonValue,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log: ${entry.action}`, error);
    }
  }

  async findByUser(userId: string, limit: number = 50) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async findByAction(action: string, limit: number = 50) {
    return this.prisma.auditLog.findMany({
      where: { action },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async findRecent(limit: number = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
    });
  }
}
