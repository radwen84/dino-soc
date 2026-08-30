import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OpenSearchService } from '../opensearch/opensearch.service';
import { CreateIocDto } from './dto/create-ioc.dto';
import { UpdateIocDto } from './dto/update-ioc.dto';
import { IocFiltersDto } from './dto/ioc-filters.dto';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class IocService {
  private readonly logger = new Logger(IocService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly opensearch: OpenSearchService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateIocDto, userId: string) {
    // Check for duplicate IOC (same type + value)
    const existing = await this.prisma.iOC.findUnique({
      where: { type_value: { type: dto.type, value: dto.value } },
    });

    if (existing) {
      throw new ConflictException(
        `IOC already exists: ${dto.type}:${dto.value} (id: ${existing.id})`,
      );
    }

    const ioc = await this.prisma.iOC.create({
      data: {
        type: dto.type,
        value: dto.value,
        description: dto.description,
        status: dto.status || 'active',
        confidence: dto.confidence,
        severity: dto.severity || 'medium',
        source: dto.source,
        sourceReference: dto.sourceReference,
        mitreTechniques: dto.mitreTechniques || [],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        tags: dto.tags || [],
        relatedIncidents: dto.relatedIncidents || [],
        createdById: userId,
      },
    });

    // Index in OpenSearch for fast lookup
    await this.indexIocInOpenSearch(ioc);

    await this.auditService.log('IOC_CREATED', {
      userId,
      resourceType: 'ioc',
      resourceId: ioc.id,
      details: { type: ioc.type, value: ioc.value },
    });

    this.eventEmitter.emit('ioc.created', ioc);
    this.logger.log(`IOC created: ${ioc.type}:${ioc.value}`);

    return ioc;
  }

  async findAll(filters: IocFiltersDto): Promise<PaginatedResult<any>> {
    const where: any = {};

    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.severity) where.severity = filters.severity;
    if (filters.source) where.source = filters.source;
    if (filters.minConfidence) where.confidence = { gte: filters.minConfidence };
    if (filters.mitreTechnique) {
      where.mitreTechniques = { has: filters.mitreTechnique };
    }
    if (filters.search) {
      where.value = { contains: filters.search, mode: 'insensitive' };
    }

    const [iocs, total] = await Promise.all([
      this.prisma.iOC.findMany({
        where,
        skip: filters.skip,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.iOC.count({ where }),
    ]);

    return {
      data: iocs,
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
    const ioc = await this.prisma.iOC.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!ioc) {
      throw new NotFoundException(`IOC not found: ${id}`);
    }

    return ioc;
  }

  async update(id: string, dto: UpdateIocDto, userId: string) {
    await this.findOne(id);

    const updated = await this.prisma.iOC.update({
      where: { id },
      data: {
        ...dto,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    await this.indexIocInOpenSearch(updated);

    await this.auditService.log('IOC_UPDATED', {
      userId,
      resourceType: 'ioc',
      resourceId: id,
      details: { changes: dto },
    });

    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.iOC.delete({ where: { id } });

    await this.auditService.log('IOC_DELETED', {
      userId,
      resourceType: 'ioc',
      resourceId: id,
    });

    this.logger.log(`IOC deleted: ${id}`);
  }

  /**
   * Search IOCs matching a given value (IP, domain, hash, etc.)
   * Used for real-time alert correlation.
   */
  async matchValue(value: string) {
    return this.prisma.iOC.findMany({
      where: {
        value: { contains: value, mode: 'insensitive' },
        status: 'active',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { confidence: 'desc' },
    });
  }

  /**
   * Bulk import IOCs (from threat intel feeds)
   */
  async bulkImport(iocs: CreateIocDto[], userIdOrSource: string = 'system') {
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const iocDto of iocs) {
      try {
        const existing = await this.prisma.iOC.findUnique({
          where: { type_value: { type: iocDto.type, value: iocDto.value } },
        });

        if (existing) {
          // Update lastSeen and confidence if already exists
          await this.prisma.iOC.update({
            where: { id: existing.id },
            data: { 
              lastSeen: new Date(),
              confidence: iocDto.confidence ?? existing.confidence,
            },
          });
          results.skipped++;
        } else {
          await this.create(iocDto, userIdOrSource);
          results.created++;
        }
      } catch (error: any) {
        results.errors.push(`${iocDto.type}:${iocDto.value} - ${error?.message || error}`);
      }
    }

    this.logger.log(
      `Bulk import: ${results.created} created, ${results.skipped} skipped, ${results.errors.length} errors`,
    );

    return results;
  }

  /**
   * Expire old IOCs automatically (runs every hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expireOldIocs() {
    const expired = await this.prisma.iOC.updateMany({
      where: {
        status: 'active',
        expiresAt: { lte: new Date() },
      },
      data: { status: 'expired' },
    });

    if (expired.count > 0) {
      this.logger.log(`Expired ${expired.count} IOCs`);
    }
  }

  /**
   * Get IOC statistics
   */
  async getStats() {
    const [byType, byStatus, bySeverity, total, activeCount] = await Promise.all([
      this.prisma.iOC.groupBy({ by: ['type'], _count: true }),
      this.prisma.iOC.groupBy({ by: ['status'], _count: true }),
      this.prisma.iOC.groupBy({ by: ['severity'], _count: true }),
      this.prisma.iOC.count(),
      this.prisma.iOC.count({ where: { status: 'active' } }),
    ]);

    return {
      total,
      active: activeCount,
      byType: byType.reduce((acc, item) => ({ ...acc, [item.type]: item._count }), {}),
      byStatus: byStatus.reduce((acc, item) => ({ ...acc, [item.status]: item._count }), {}),
      bySeverity: bySeverity.reduce((acc, item) => ({ ...acc, [item.severity]: item._count }), {}),
    };
  }

  private async indexIocInOpenSearch(ioc: any) {
    try {
      const document = {
        type: ioc.type,
        value: ioc.value,
        status: ioc.status,
        confidence: ioc.confidence,
        severity: ioc.severity,
        source: ioc.source,
        mitreTechniques: ioc.mitreTechniques,
        createdAt: ioc.createdAt,
      };

      // Si OpenSearchService.index accepte un objet Body direct :
      await this.opensearch.index('minisoc-iocs', ioc.id, document as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to index IOC in OpenSearch: ${message}`);
    }
  }
}