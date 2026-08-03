import { Alert, AlertStatus, Prisma } from '@prisma/client';
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenSearchService } from '../opensearch/opensearch.service';
import { AlertFiltersDto } from './dto/alert-filters.dto';
import { PaginatedResult } from '../common/dto/pagination.dto';

interface AlertTimelinePoint {
  hour: Date;
  count: bigint;
  max_level: number;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly opensearch: OpenSearchService,
  ) {}

  async findAll(
    filters: AlertFiltersDto,
  ): Promise<PaginatedResult<Alert>> {
    const where: Prisma.AlertWhereInput = {};

    if (filters.status) where.status = filters.status as AlertStatus;
    if (filters.level) where.level = { gte: filters.level };
    if (filters.source) where.source = filters.source;
    if (filters.srcIp) where.srcIp = filters.srcIp;
    if (filters.ruleId) where.ruleId = filters.ruleId;
    if (filters.mitreTechnique)
      where.mitreTechnique = filters.mitreTechnique;
    if (filters.incidentId) where.incidentId = filters.incidentId;

    const [alerts, total] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        skip: filters.skip,
        take: filters.limit,
        orderBy: { timestamp: 'desc' },
        include: {
          incident: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.alert.count({ where }),
    ]);

    return {
      data: alerts,
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

  async findById(
    id: string,
  ): Promise<Alert> {
    const alert = await this.prisma.alert.findUnique({
      where: { id },
      include: { incident: true },
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    return alert;
  }

  async updateStatus(
    id: string,
    status: string,
    incidentId?: string,
  ): Promise<Alert> {
    return this.prisma.alert.update({
      where: { id },
      data: {
        status: status as AlertStatus,
        incidentId,
      },
    });
  }

  async bulkUpdateStatus(
    ids: string[],
    status: string,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.alert.updateMany({
      where: {
        id: {
          in: ids,
        },
      },
      data: {
        status: status as AlertStatus,
      },
    });
  }

  async linkToIncident(
    alertIds: string[],
    incidentId: string,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.alert.updateMany({
      where: {
        id: {
          in: alertIds,
        },
      },
      data: {
        incidentId,
        status: 'escalated',
      },
    });
  }

  async searchInOpenSearch(
    query: string,
    from = 0,
    size = 50,
  ): Promise<unknown> {
    try {
      const result = await this.opensearch.search(
        'wazuh-alerts-*',
        {
          query: {
            bool: {
              should: [
                { match: { 'rule.description': query } },
                { match: { 'agent.name': query } },
                { match: { 'data.srcip': query } },
                { match: { 'rule.mitre.id': query } },
              ],
            },
          },
          sort: [{ timestamp: { order: 'desc' } }],
          from,
          size,
        },
      );

      return result;
    } catch (error) {
      this.logger.error('OpenSearch search failed', error);

      return {
        hits: {
          total: { value: 0 },
          hits: [],
        },
      };
    }
  }

  async getRecentCritical(
    limit = 20,
  ): Promise<Alert[]> {
    return this.prisma.alert.findMany({
      where: {
        level: { gte: 12 },
        status: 'new',
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    });
  }

  async countByTimeRange(
    hours = 24,
  ): Promise<number> {
    const since = new Date(Date.now() - hours * 3600000);

    return this.prisma.alert.count({
      where: {
        createdAt: {
          gte: since,
        },
      },
    });
  }

  async getAlertTimeline(
    hours = 24,
  ): Promise<AlertTimelinePoint[]> {
    const since = new Date(Date.now() - hours * 3600000);

    const alerts = await this.prisma.$queryRaw<AlertTimelinePoint[]>`
      SELECT
        date_trunc('hour', timestamp) as hour,
        COUNT(*) as count,
        MAX(level) as max_level
      FROM alerts
      WHERE timestamp >= ${since}
      GROUP BY hour
      ORDER BY hour ASC
    `;

    return alerts;
  }
}