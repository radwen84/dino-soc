import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Asset, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WazuhService } from '../wazuh/wazuh.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssetFiltersDto } from './dto/asset-filters.dto';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

// Interface pour typer les réponses des agents Wazuh
export interface WazuhAgent {
  id: string;
  name?: string;
  ip?: string;
  status?: string;
  os?: {
    name?: string;
    version?: string;
  };
}

// Interface pour typer les retours de la statistique getStats()
export interface AssetStats {
  total: number;
  active: number;
  inactive: number;
  byCriticality: Record<string, number>;
  byOs: Record<string, number>;
  byDepartment: Record<string, number>;
}

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly wazuhService: WazuhService,
  ) {}

  async create(dto: CreateAssetDto, userId: string): Promise<Asset> {
    const asset = await this.prisma.asset.create({
      data: {
        hostname: dto.hostname,
        ipAddress: dto.ipAddress,
        macAddress: dto.macAddress,
        os: dto.os,
        osVersion: dto.osVersion,
        criticality: dto.criticality || 'medium',
        owner: dto.owner,
        department: dto.department,
        location: dto.location,
        tags: dto.tags || [],
        wazuhAgentId: dto.wazuhAgentId,
        isActive: dto.isActive ?? true,
        metadata: (dto.metadata as Prisma.InputJsonValue) || {},
        lastSeen: new Date(),
      },
    });

    await this.auditService.log('ASSET_CREATED', {
      userId,
      resourceType: 'asset',
      resourceId: asset.id,
      details: { hostname: asset.hostname },
    });

    this.logger.log(`Asset created: ${asset.hostname} (${asset.ipAddress})`);
    return asset;
  }

  async findAll(filters: AssetFiltersDto): Promise<PaginatedResult<Asset>> {
    const where: Prisma.AssetWhereInput = {};

    if (filters.criticality) where.criticality = filters.criticality;
    if (filters.os) where.os = { contains: filters.os, mode: 'insensitive' };
    if (filters.department) where.department = filters.department;
    if (filters.location) where.location = filters.location;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    if (filters.search) {
      where.OR = [
        { hostname: { contains: filters.search, mode: 'insensitive' } },
        { ipAddress: { contains: filters.search } },
      ];
    }

    const [assets, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        skip: filters.skip,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.asset.count({ where }),
    ]);

    return {
      data: assets,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
        hasNext: filters.page * filters.limit < total,
        hasPrev: filters.page > 1,
      },
    };
  }

  async findOne(id: string): Promise<Asset> {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`Asset not found: ${id}`);
    }
    return asset;
  }

  async findByIp(ip: string): Promise<Asset | null> {
    return this.prisma.asset.findFirst({
      where: { ipAddress: ip, isActive: true },
    });
  }

  async findByHostname(hostname: string): Promise<Asset | null> {
    return this.prisma.asset.findFirst({
      where: { hostname: { equals: hostname, mode: 'insensitive' }, isActive: true },
    });
  }

  async update(id: string, dto: UpdateAssetDto, userId: string): Promise<Asset> {
    await this.findOne(id);

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        ...dto,
        metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined,
      },
    });

    await this.auditService.log('ASSET_UPDATED', {
      userId,
      resourceType: 'asset',
      resourceId: id,
      details: { changes: dto as Prisma.InputJsonValue },
    });

    return updated;
  }

  async remove(id: string, userId: string): Promise<Asset> {
    await this.findOne(id);
    const deleted = await this.prisma.asset.delete({ where: { id } });

    await this.auditService.log('ASSET_DELETED', {
      userId,
      resourceType: 'asset',
      resourceId: id,
    });

    this.logger.log(`Asset deleted: ${id}`);
    return deleted;
  }

  /**
   * Sync assets with Wazuh agents (runs every 6 hours)
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async syncWithWazuh(): Promise<void> {
    this.logger.log('Starting Wazuh agent sync...');

    try {
      const agents: WazuhAgent[] = await this.wazuhService.getAgents();

      for (const agent of agents) {
        const existing = await this.prisma.asset.findFirst({
          where: { wazuhAgentId: agent.id },
        });

        if (existing) {
          await this.prisma.asset.update({
            where: { id: existing.id },
            data: {
              ipAddress: agent.ip || existing.ipAddress,
              os: agent.os?.name || existing.os,
              osVersion: agent.os?.version || existing.osVersion,
              lastSeen: new Date(),
              isActive: agent.status === 'active',
            },
          });
        } else {
          await this.prisma.asset.create({
            data: {
              hostname: agent.name || `agent-${agent.id}`,
              ipAddress: agent.ip,
              os: agent.os?.name,
              osVersion: agent.os?.version,
              wazuhAgentId: agent.id,
              criticality: 'medium',
              isActive: agent.status === 'active',
              lastSeen: new Date(),
              metadata: {
                autoDiscovered: true,
                wazuhAgent: agent as unknown as Prisma.InputJsonValue,
              },
            },
          });
        }
      }

      this.logger.log(`Wazuh sync completed: ${agents.length} agents processed`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Wazuh sync failed: ${err.message}`);
    }
  }

  /**
   * Get asset statistics
   */
  async getStats(): Promise<AssetStats> {
    const [total, active, byCriticality, byOs, byDepartment] = await Promise.all([
      this.prisma.asset.count(),
      this.prisma.asset.count({ where: { isActive: true } }),
      this.prisma.asset.groupBy({ by: ['criticality'], _count: true }),
      this.prisma.asset.groupBy({ by: ['os'], _count: true, where: { os: { not: null } } }),
      this.prisma.asset.groupBy({
        by: ['department'],
        _count: true,
        where: { department: { not: null } },
      }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      byCriticality: byCriticality.reduce<Record<string, number>>(
        (acc, item) => ({ ...acc, [item.criticality]: item._count }),
        {},
      ),
      byOs: byOs.reduce<Record<string, number>>(
        (acc, item) => (item.os ? { ...acc, [item.os]: item._count } : acc),
        {},
      ),
      byDepartment: byDepartment.reduce<Record<string, number>>(
        (acc, item) => (item.department ? { ...acc, [item.department]: item._count } : acc),
        {},
      ),
    };
  }
}
