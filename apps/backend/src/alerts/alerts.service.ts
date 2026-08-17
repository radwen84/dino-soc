import { Alert, AlertStatus, Prisma } from '@prisma/client';
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ============================================
  // SYNC: OpenSearch → PostgreSQL (Phase 1)
  // ============================================

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncFromOpenSearch(): Promise<{ synced: number; errors: number }> {
    this.logger.log('Starting OpenSearch → PostgreSQL sync...');
    let synced = 0;
    let errors = 0;

    try {
      // Determine the last known timestamp in Postgres
      const lastAlert = await this.prisma.alert.findFirst({
        where: { wazuhAlertId: { not: null } },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });

      const since = lastAlert?.timestamp ?? new Date(Date.now() - 24 * 3600000); // default: last 24h

      // Query OpenSearch for alerts newer than our last sync
      // FIX: Use '@timestamp' (Filebeat/OpenSearch field) instead of 'timestamp' (Wazuh internal)
      const result = await this.opensearch.search('wazuh-alerts-*', {
        query: {
          range: {
            '@timestamp': { gt: since.toISOString() },
          },
        },
        sort: [{ '@timestamp': { order: 'asc' } }],
        size: 500,
      });

      const hits = result?.hits?.hits ?? [];

      if (hits.length === 0) {
        this.logger.log('Sync complete: no new alerts in OpenSearch.');
        return { synced: 0, errors: 0 };
      }

      this.logger.log(`Found ${hits.length} new alerts in OpenSearch, syncing...`);

      for (const hit of hits) {
        try {
          const rawDoc = hit._source;
          const wazuhAlertId = hit._id;

          // FIX: Parse the Wazuh JSON from _source.message (Filebeat wraps it as a string)
          // Supports both formats:
          //   A) Structured Wazuh doc directly in _source (no Filebeat)
          //   B) Filebeat document with Wazuh JSON inside _source.message
          let doc = rawDoc;
          if (typeof rawDoc.message === 'string') {
            try {
              doc = JSON.parse(rawDoc.message);
            } catch (parseError) {
              this.logger.warn(
                `Failed to parse Wazuh message for OpenSearch alert ${wazuhAlertId}`,
              );
              errors++;
              continue;
            }
          }

          // Map parsed Wazuh document to Prisma Alert fields
          const alertData: Prisma.AlertCreateInput = {
            wazuhAlertId,
            ruleId: doc.rule?.id?.toString() ?? null,
            ruleDescription: doc.rule?.description ?? null,
            level: doc.rule?.level != null ? Number(doc.rule.level) : null,
            source: doc.agent?.name ? 'wazuh' : 'unknown',
            agentId: doc.agent?.id?.toString() ?? null,
            agentName: doc.agent?.name ?? null,
            srcIp: doc.data?.srcip ?? null,
            dstIp: doc.data?.dstip ?? null,
            srcPort: doc.data?.srcport != null ? Number(doc.data.srcport) : null,
            dstPort: doc.data?.dstport != null ? Number(doc.data.dstport) : null,
            mitreTactic: Array.isArray(doc.rule?.mitre?.tactic)
              ? doc.rule.mitre.tactic[0]
              : doc.rule?.mitre?.tactic ?? null,
            mitreTechnique: Array.isArray(doc.rule?.mitre?.id)
              ? doc.rule.mitre.id[0]
              : doc.rule?.mitre?.id ?? null,
            status: 'new' as AlertStatus,
            rawLog: doc as any,
            timestamp: new Date(doc.timestamp || hit._source['@timestamp'] || new Date()),
          };

          // Upsert by wazuhAlertId — idempotent, safe for re-runs
          const upserted = await this.prisma.alert.upsert({
            where: { wazuhAlertId },
            create: alertData,
            update: {}, // no-op on existing — don't overwrite analyst modifications
          });

          // Check if this was a creation (createdAt ~ now) to emit event
          const isNew =
            Math.abs(upserted.createdAt.getTime() - Date.now()) < 10000;

          if (isNew) {
            synced++;
            this.eventEmitter.emit('alert.new', upserted);
          }
        } catch (error) {
          // Skip duplicate constraint errors silently, log others
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            // Already exists — expected for idempotent sync
          } else {
            errors++;
            this.logger.error(
              `Failed to sync alert ${hit._id}: ${error.message}`,
            );
          }
        }
      }

      this.logger.log(
        `Sync complete: ${synced} new alerts synced, ${errors} errors.`,
      );
    } catch (error) {
      this.logger.error('OpenSearch sync failed entirely', error);
    }

    return { synced, errors };
  }

  // ============================================
  // EXISTING METHODS (unchanged)
  // ============================================

  async findAll(filters: AlertFiltersDto): Promise<PaginatedResult<Alert>> {
    const where: Prisma.AlertWhereInput = {};

    if (filters.status) where.status = filters.status as AlertStatus;
    if (filters.level) where.level = { gte: filters.level };
    if (filters.source) where.source = filters.source;
    if (filters.srcIp) where.srcIp = filters.srcIp;
    if (filters.ruleId) where.ruleId = filters.ruleId;
    if (filters.mitreTechnique) where.mitreTechnique = filters.mitreTechnique;
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

  async findById(id: string): Promise<Alert> {
    const alert = await this.prisma.alert.findUnique({
      where: { id },
      include: { incident: true },
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    return alert;
  }

  async updateStatus(id: string, status: string, incidentId?: string): Promise<Alert> {
    return this.prisma.alert.update({
      where: { id },
      data: {
        status: status as AlertStatus,
        incidentId,
      },
    });
  }

  async bulkUpdateStatus(ids: string[], status: string): Promise<Prisma.BatchPayload> {
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

  async linkToIncident(alertIds: string[], incidentId: string): Promise<Prisma.BatchPayload> {
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

  async searchInOpenSearch(query: string, from = 0, size = 50): Promise<unknown> {
    try {
      const result = await this.opensearch.search('wazuh-alerts-*', {
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
        sort: [{ '@timestamp': { order: 'desc' } }],
        from,
        size,
      });

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

  async getRecentCritical(limit = 20): Promise<Alert[]> {
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

  async countByTimeRange(hours = 24): Promise<number> {
    const since = new Date(Date.now() - hours * 3600000);

    return this.prisma.alert.count({
      where: {
        createdAt: {
          gte: since,
        },
      },
    });
  }

  async getAlertTimeline(hours = 24): Promise<AlertTimelinePoint[]> {
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
