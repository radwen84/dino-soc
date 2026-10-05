import { Injectable, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, Registry, Counter, Histogram, Gauge } from 'prom-client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MetricsService implements OnModuleInit {
  public readonly registry = new Registry();

  // HTTP metrics
  public readonly httpRequestDuration: Histogram;
  public readonly httpRequestsTotal: Counter;

  // SOC metrics
  public readonly incidentsCreated: Counter;
  public readonly alertsProcessed: Counter;
  public readonly iocMatches: Counter;
  public readonly authLoginFailures: Counter;
  public readonly authLoginSuccess: Counter;

  // SOAR metrics
  public readonly soarExecutionsTotal: Counter;
  public readonly soarFailuresTotal: Counter;

  // ML metrics
  public readonly mlPredictionsTotal: Counter;
  public readonly mlAnomaliesTotal: Counter;

  // Gauges
  public readonly activeIncidents: Gauge;
  public readonly activeAlerts: Gauge;
  public readonly connectedUsers: Gauge;

  constructor(private readonly prisma: PrismaService) {
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.incidentsCreated = new Counter({
      name: 'incidents_created_total',
      help: 'Total incidents created',
      labelNames: ['severity'],
      registers: [this.registry],
    });

    this.alertsProcessed = new Counter({
      name: 'alerts_processed_total',
      help: 'Total alerts processed',
      labelNames: ['source', 'status'],
      registers: [this.registry],
    });

    this.iocMatches = new Counter({
      name: 'ioc_matches_total',
      help: 'Total IOC matches detected',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.authLoginFailures = new Counter({
      name: 'auth_login_failures_total',
      help: 'Total failed login attempts',
      registers: [this.registry],
    });

    this.authLoginSuccess = new Counter({
      name: 'auth_login_success_total',
      help: 'Total successful logins',
      registers: [this.registry],
    });

    this.soarExecutionsTotal = new Counter({
      name: 'minisoc_soar_executions_total',
      help: 'Total SOAR playbook executions',
      labelNames: ['playbook', 'status'],
      registers: [this.registry],
    });

    this.soarFailuresTotal = new Counter({
      name: 'minisoc_soar_failures_total',
      help: 'Total SOAR playbook failures',
      labelNames: ['playbook'],
      registers: [this.registry],
    });

    this.mlPredictionsTotal = new Counter({
      name: 'minisoc_ml_predictions_total',
      help: 'Total ML predictions made',
      labelNames: ['endpoint'],
      registers: [this.registry],
    });

    this.mlAnomaliesTotal = new Counter({
      name: 'minisoc_ml_anomalies_total',
      help: 'Total anomalies detected by ML engine',
      registers: [this.registry],
    });

    this.activeIncidents = new Gauge({
      name: 'active_incidents',
      help: 'Number of active incidents',
      labelNames: ['severity'],
      registers: [this.registry],
    });

    this.activeAlerts = new Gauge({
      name: 'active_alerts',
      help: 'Number of unresolved alerts',
      registers: [this.registry],
    });

    this.connectedUsers = new Gauge({
      name: 'connected_users',
      help: 'Number of currently connected WebSocket users',
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    collectDefaultMetrics({ register: this.registry });
  }

  /**
   * Synchronise les données PostgreSQL et initialise toutes les métriques
   * avant chaque appel du scraper Prometheus
   */
  private async syncDatabaseMetrics(): Promise<void> {
    try {
      const severities = ['critical', 'high', 'medium', 'low', 'informational'];

      // 1. Active Incidents (Gauge)
      severities.forEach((sev) => this.activeIncidents.labels(sev).set(0));

      const activeBySeverity = await this.prisma.incident.groupBy({
        by: ['severity'],
        _count: { id: true },
        where: {
          status: { notIn: ['closed', 'false_positive'] },
          deletedAt: null,
        },
      });

      let totalActive = 0;
      for (const group of activeBySeverity) {
        const count = group._count.id;
        totalActive += count;
        this.activeIncidents.labels(group.severity.toLowerCase()).set(count);
      }
      this.activeIncidents.labels('all').set(totalActive);

      // 2. Incidents Created (Counter)
      const totalBySeverity = await this.prisma.incident.groupBy({
        by: ['severity'],
        _count: { id: true },
        where: { deletedAt: null },
      });

      this.incidentsCreated.reset();
      let totalCreated = 0;
      for (const group of totalBySeverity) {
        const count = group._count.id;
        totalCreated += count;
        if (count > 0) {
          this.incidentsCreated.labels(group.severity.toLowerCase()).inc(count);
        }
      }
      if (totalCreated > 0) {
        this.incidentsCreated.labels('all').inc(totalCreated);
      } else {
        this.incidentsCreated.labels('all').inc(0);
      }

      // 3. IOC Matches Total
      const iocsCount = await this.prisma.iOC.count().catch(() => 0);
      this.iocMatches.reset();
      this.iocMatches.labels('ip').inc(iocsCount);
      this.iocMatches.labels('domain').inc(0);
      this.iocMatches.labels('hash').inc(0);

      // 4. Active Alerts (filtre sur statut non résolu)
      const alertsCount = await this.prisma.alert.count({
        where: { status: { notIn: ['resolved'] } },
      }).catch(() => 0);
      this.activeAlerts.set(alertsCount);

      // 5. Alerts Processed Total (Nombre total d'alertes en base)
      const totalAlerts = await this.prisma.alert.count().catch(() => 0);
      this.alertsProcessed.reset();
      if (totalAlerts > 0) {
        this.alertsProcessed.labels('suricata', 'processed').inc(totalAlerts);
      } else {
        this.alertsProcessed.labels('suricata', 'processed').inc(0);
      }

      // 6. Initialisation des métriques sans labels (Counters & Gauges)
      if ((await this.authLoginFailures.get()).values.length === 0) {
        this.authLoginFailures.inc(0);
      }
      if ((await this.authLoginSuccess.get()).values.length === 0) {
        this.authLoginSuccess.inc(0);
      }
      if ((await this.mlAnomaliesTotal.get()).values.length === 0) {
        this.mlAnomaliesTotal.inc(0);
      }
      if ((await this.connectedUsers.get()).values.length === 0) {
        this.connectedUsers.set(0);
      }

      // 7. Initialisation des métriques avec labels
      this.soarExecutionsTotal.labels('default', 'success').inc(0);
      this.soarFailuresTotal.labels('default').inc(0);
      this.mlPredictionsTotal.labels('risk_score').inc(0);
    } catch {
      // Ignorer l'erreur si la BDD est temporairement indisponible pour ne pas bloquer l'endpoint
    }
  }

  async getMetrics(): Promise<string> {
    await this.syncDatabaseMetrics();
    return this.registry.metrics();
  }
}
