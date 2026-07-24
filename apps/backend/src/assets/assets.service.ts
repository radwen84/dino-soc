import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WazuhService } from '../wazuh/wazuh.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssetFiltersDto } from './dto/asset-filters.dto';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly wazuhService: WazuhService,
  ) {}

  async create(dto: CreateAssetDto, userId: string) {
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
        metadata: dto.metadata || {},
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

  async findAll(filters: AssetFiltersDto): Promise<PaginatedResult<any>> {
    const where: any = {};

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

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`Asset not found: ${id}`);
    }
    return asset;
  }

  async findByIp(ip: string) {
    return this.prisma.asset.findFirst({
      where: { ipAddress: ip, isActive: true },
    });
  }

  async findByHostname(hostname: string) {
    return this.prisma.asset.findFirst({
      where: { hostname: { equals: hostname, mode: 'insensitive' }, isActive: true },
    });
  }

  async update(id: string, dto: UpdateAssetDto, userId: string) {
    await this.findOne(id);

    const updated = await this.prisma.asset.update({
      where: { id },
      data: { ...dto, metadata: dto.metadata || undefined },
    });

    await this.auditService.log('ASSET_UPDATED', {
      userId,
      resourceType: 'asset',
      resourceId: id,
      details: { changes: dto },
    });

    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.asset.delete({ where: { id } });

    await this.auditService.log('ASSET_DELETED', {
      userId,
      resourceType: 'asset',
      resourceId: id,
    });

    this.logger.log(`Asset deleted: ${id}`);
  }

  /**
   * Sync assets with Wazuh agents (runs every 6 hours)
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async syncWithWazuh() {
    this.logger.log('Starting Wazuh agent sync...');

    try {
      const agents = await this.wazuhService.getAgents();

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
              metadata: { autoDiscovered: true, wazuhAgent: agent },
            },
          });
        }
      }

      this.logger.log(`Wazuh sync completed: ${agents.length} agents processed`);
    } catch (error) {
      this.logger.error(`Wazuh sync failed: ${error.message}`);
    }
  }

  /**
   * Get asset statistics
   */
  async getStats() {
    const [total, active, byCriticality, byOs, byDepartment] = await Promise.all([
      this.prisma.asset.count(),
      this.prisma.asset.count({ where: { isActive: true } }),
      this.prisma.asset.groupBy({ by: ['criticality'], _count: true }),
      this.prisma.asset.groupBy({ by: ['os'], _count: true, where: { os: { not: null } } }),
      this.prisma.asset.groupBy({ by: ['department'], _count: true, where: { department: { not: null } } }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      byCriticality: byCriticality.reduce((acc, item) => ({ ...acc, [item.criticality]: item._count }), {}),
      byOs: byOs.reduce((acc, item) => ({ ...acc, [item.os]: item._count }), {}),
      byDepartment: byDepartment.reduce((acc, item) => ({ ...acc, [item.department]: item._count }), {}),
    };
  }
}
