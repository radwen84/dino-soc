import { Alert, AlertStatus, IncidentSeverity, Prisma } from '@prisma/client';
import { Injectable, NotFoundException, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { OpenSearchService } from '../opensearch/opensearch.service';
import { AlertFiltersDto } from './dto/alert-filters.dto';
import { PaginatedResult } from '../common/dto/pagination.dto';

interface AlertTimelinePoint {
  hour: Date;
  count: bigint;
  max_level: number;
}

interface WazuhRawDoc {
  message?: string;
  timestamp?: string;
  '@timestamp'?: string;
  src_ip?: string;
  dst_ip?: string;
  dest_ip?: string;
  src_port?: number | string;
  dst_port?: number | string;
  dest_port?: number | string;
  rule?: {
    id?: string | number;
    description?: string;
    level?: number | string;
    mitre?: {
      tactic?: string | string[];
      id?: string | string[];
    };
  };
  agent?: {
    id?: string | number;
    name?: string;
    ip?: string;
  };
  data?: {
    srcip?: string;
    dstip?: string;
    src_ip?: string;
    dst_ip?: string;
    dest_ip?: string;
    srcport?: number | string;
    dstport?: number | string;
    src_port?: number | string;
    dst_port?: number | string;
    dest_port?: number | string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

@Injectable()
export class AlertsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly opensearch: OpenSearchService,
    private readonly eventEmitter: EventEmitter2,
    private readonly httpService: HttpService, // Injection du service HTTP NestJS
  ) {}

  // ============================================
  // BOOTSTRAP & CRON SYNC
  // ============================================

  async onApplicationBootstrap() {
    this.logger.log('Running initial OpenSearch sync on startup...');
    await this.syncFromOpenSearch();
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncFromOpenSearch(): Promise<{ synced: number; errors: number }> {
    this.logger.log('Starting OpenSearch → PostgreSQL sync...');
    let synced = 0;
    let errors = 0;

    try {
      const lastAlert = await this.prisma.alert.findFirst({
        where: { wazuhAlertId: { not: null } },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });

      const since = lastAlert?.timestamp ?? new Date(Date.now() - 24 * 3600000);

      const result = (await this.opensearch.search('wazuh-alerts-*', {
        query: {
          range: {
            '@timestamp': { gt: since.toISOString() },
          },
        },
        sort: [{ '@timestamp': { order: 'asc' } }],
        size: 500,
      })) as {
        hits?: {
          hits?: Array<{
            _id: string;
            _source: WazuhRawDoc;
          }>;
        };
      };

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

          let doc: WazuhRawDoc = rawDoc;
          if (typeof rawDoc.message === 'string') {
            try {
              doc = JSON.parse(rawDoc.message) as WazuhRawDoc;
            } catch {
              this.logger.warn(`Failed to parse Wazuh message for alert ${wazuhAlertId}`);
              errors++;
              continue;
            }
          }

          // Extraction des IPs et Ports
          const srcIp = doc.src_ip || doc.data?.src_ip || doc.data?.srcip || doc.agent?.ip || null;
          const dstIp = doc.dst_ip || doc.dest_ip || doc.data?.dest_ip || doc.data?.dst_ip || doc.data?.dstip || null;
          const rawSrcPort = doc.src_port || doc.data?.src_port || doc.data?.srcport;
          const rawDstPort = doc.dst_port || doc.data?.dst_port || doc.data?.dest_port || doc.data?.dstport;

          const srcPort = rawSrcPort != null ? Number(rawSrcPort) : null;
          const dstPort = rawDstPort != null ? Number(rawDstPort) : null;
          const level = doc.rule?.level != null ? Number(doc.rule.level) : null;

          const alertData: Prisma.AlertCreateInput = {
            wazuhAlertId,
            ruleId: doc.rule?.id?.toString() ?? null,
            ruleDescription: doc.rule?.description ?? null,
            level,
            source: doc.agent?.name ? 'wazuh' : 'unknown',
            agentId: doc.agent?.id?.toString() ?? null,
            agentName: doc.agent?.name ?? null,
            srcIp,
            dstIp,
            srcPort,
            dstPort,
            mitreTactic: Array.isArray(doc.rule?.mitre?.tactic)
              ? doc.rule.mitre.tactic[0]
              : (doc.rule?.mitre?.tactic ?? null),
            mitreTechnique: Array.isArray(doc.rule?.mitre?.id)
              ? doc.rule.mitre.id[0]
              : (doc.rule?.mitre?.id ?? null),
            status: 'new' as AlertStatus,
            rawLog: doc as Prisma.InputJsonValue,
            timestamp: new Date(doc.timestamp || hit._source['@timestamp'] || new Date()),
          };

          const upserted = await this.prisma.alert.upsert({
            where: { wazuhAlertId },
            create: alertData,
            update: { srcIp, dstIp, srcPort, dstPort },
          });

          // Traitement des alertes non encore escaladées
          if (upserted.status === 'new') {
            synced++;
            this.eventEmitter.emit('alert.new', upserted);

            // ML SCORING + THREAT INTEL + AUTO-INCIDENT + N8N WEBHOOK
            await this.processRiskAndAutoEscalate(upserted);
          }
        } catch (error) {
          const err = error as Error;
          if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
            errors++;
            this.logger.error(`Failed to sync alert ${hit._id}: ${err.message}`);
          }
        }
      }

      this.logger.log(`Sync complete: ${synced} new alerts processed, ${errors} errors.`);
    } catch (error) {
      this.logger.error('OpenSearch sync failed entirely', error);
    }

    return { synced, errors };
  }

  // ============================================
  // ENGINE: ML Risk Score & Auto Escalation
  // ============================================

  private async processRiskAndAutoEscalate(alert: Alert): Promise<void> {
    try {
      // 1. Calcul du Risk Score (ML Mock / Heuristique)
      const threatIntelScore = this.evaluateThreatIntel(alert.srcIp);
      const levelBaseScore = (alert.level || 1) * 6; // Max ~96 pour level 16
      const riskScore = Math.min(Math.round(levelBaseScore + threatIntelScore), 100);

      this.logger.log(
        `Calculated Risk Score for Alert ${alert.id}: ${riskScore} (Level: ${alert.level}, ThreatIntel Bonus: ${threatIntelScore})`,
      );

      // 2. Seuil d'escalade automatique (riskScore >= 70)
      if (riskScore >= 70 && (!alert.incidentId || alert.status === 'new')) {
        this.logger.warn(
          `High risk score detected (${riskScore} >= 70) for alert ${alert.id}. Triggering auto-incident...`,
        );

        const severity = this.mapScoreToSeverity(riskScore);

        const incident = await this.prisma.incident.create({
          data: {
            title: `[Auto-SOC] ${alert.ruleDescription || `Règle ${alert.ruleId}`}`,
            description: `Incident généré automatiquement suite à la détection d'une menace à fort risque.\n` +
                         `Règle Wazuh: ${alert.ruleId} (Niveau ${alert.level})\n` +
                         `IP Source: ${alert.srcIp || 'N/A'} -> IP Dest: ${alert.dstIp || 'N/A'}\n` +
                         `Score de Risque ML: ${riskScore}/100`,
            severity,
            status: 'new',
            category: 'automated_detection',
            source: 'suricata_wazuh_soar',
            sourceAlertIds: [alert.id],
            affectedAssets: alert.dstIp ? [alert.dstIp] : alert.srcIp ? [alert.srcIp] : ['unknown'],
            affectedUsers: [],
            mitreTactics: alert.mitreTactic ? [alert.mitreTactic] : [],
            mitreTechniques: alert.mitreTechnique ? [alert.mitreTechnique] : [],
            riskScore,
            tags: ['auto-escalated', 'soar-triggered', alert.srcIp ? `ip:${alert.srcIp}` : 'no-ip'],
            detectedAt: alert.timestamp || new Date(),
          },
        });

        // Mettre à jour le statut de l'alerte
        await this.prisma.alert.update({
          where: { id: alert.id },
          data: {
            status: 'escalated',
            incidentId: incident.id,
          },
        });

        // Événements internes
        this.eventEmitter.emit('incident.created', incident);
        this.eventEmitter.emit('soar.playbook.execute', {
          incidentId: incident.id,
          action: 'BLOCK_IP',
          targetIp: alert.srcIp,
        });

        // 🚀 ENVOI DU WEBHOOK VERS N8N
        const soarWebhookUrl =
          process.env.N8N_SOAR_WEBHOOK_URL ||
          'http://minisoc-n8n:5678/webhook/incident-response';

        try {
          await firstValueFrom(
            this.httpService.post(soarWebhookUrl, {
              title: incident.title,
              description: incident.description,
              severity: 'critical',
              category: incident.category,
              srcIp: alert.srcIp,
              dstIp: alert.dstIp,
              riskScore: incident.riskScore,
            }),
          );
          this.logger.log(`SOAR Webhook triggered successfully on n8n (${soarWebhookUrl}).`);
        } catch (webhookErr) {
          const err = webhookErr as Error;
          this.logger.error(`Failed to trigger n8n SOAR webhook: ${err.message}`);
        }

        this.logger.log(`Incident ${incident.id} auto-created and SOAR playbook emitted.`);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error during risk evaluation for alert ${alert.id}: ${err.message}`);
    }
  }

  private evaluateThreatIntel(srcIp: string | null): number {
    if (!srcIp) return 0;

    // Plages privées RFC1918 / Docker
    if (srcIp.startsWith('172.') || srcIp.startsWith('10.') || srcIp.startsWith('192.168.')) {
      return 10;
    }

    // IP externe
    return 25;
  }

  private mapScoreToSeverity(score: number): IncidentSeverity {
    if (score >= 85) return IncidentSeverity.critical;
    if (score >= 70) return IncidentSeverity.high;
    if (score >= 40) return IncidentSeverity.medium;
    return IncidentSeverity.low;
  }

  // ============================================
  // MÉTHODES STANDARD API
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
            select: { id: true, title: true, status: true },
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

    if (!alert) throw new NotFoundException('Alert not found');
    return alert;
  }

  async updateStatus(id: string, status: string, incidentId?: string): Promise<Alert> {
    return this.prisma.alert.update({
      where: { id },
      data: { status: status as AlertStatus, incidentId },
    });
  }

  async bulkUpdateStatus(ids: string[], status: string): Promise<Prisma.BatchPayload> {
    return this.prisma.alert.updateMany({
      where: { id: { in: ids } },
      data: { status: status as AlertStatus },
    });
  }

  async linkToIncident(alertIds: string[], incidentId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.alert.updateMany({
      where: { id: { in: alertIds } },
      data: { incidentId, status: 'escalated' },
    });
  }

  async searchInOpenSearch(query: string, from = 0, size = 50): Promise<unknown> {
    try {
      return await this.opensearch.search('wazuh-alerts-*', {
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
    } catch (error) {
      this.logger.error('OpenSearch search failed', error);
      return { hits: { total: { value: 0 }, hits: [] } };
    }
  }

  async getRecentCritical(limit = 20): Promise<Alert[]> {
    return this.prisma.alert.findMany({
      where: { level: { gte: 12 }, status: 'new' },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async countByTimeRange(hours = 24): Promise<number> {
    const since = new Date(Date.now() - hours * 3600000);
    return this.prisma.alert.count({ where: { createdAt: { gte: since } } });
  }

  async getAlertTimeline(hours = 24): Promise<AlertTimelinePoint[]> {
    const since = new Date(Date.now() - hours * 3600000);
    return this.prisma.$queryRaw<AlertTimelinePoint[]>`
      SELECT
        date_trunc('hour', timestamp) as hour,
        COUNT(*) as count,
        MAX(level) as max_level
      FROM alerts
      WHERE timestamp >= ${since}
      GROUP BY hour
      ORDER BY hour ASC
    `;
  }
}
