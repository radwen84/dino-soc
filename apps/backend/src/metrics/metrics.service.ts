import { Injectable, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, Registry, Counter, Histogram, Gauge } from 'prom-client';

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

  constructor() {
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

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
