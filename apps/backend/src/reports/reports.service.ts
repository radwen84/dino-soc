import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ReportFiltersDto,
  ReportType,
  ReportPeriod,
} from './dto/report-filters.dto';

interface DateRange {
  start: Date;
  end: Date;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async generate(filters: ReportFiltersDto, userId: string) {
    const dateRange = this.getDateRange(filters);

    let report: any;

    switch (filters.type) {
      case ReportType.EXECUTIVE_SUMMARY:
        report = await this.generateExecutiveSummary(dateRange);
        break;
      case ReportType.INCIDENT_REPORT:
        report = await this.generateIncidentReport(dateRange, filters.incidentId);
        break;
      case ReportType.THREAT_LANDSCAPE:
        report = await this.generateThreatLandscape(dateRange);
        break;
      case ReportType.KPI_METRICS:
        report = await this.generateKpiMetrics(dateRange);
        break;
      case ReportType.COMPLIANCE:
        report = await this.generateComplianceReport(dateRange);
        break;
      case ReportType.ASSET_INVENTORY:
        report = await this.generateAssetInventory();
        break;
      default:
        report = await this.generateExecutiveSummary(dateRange);
    }

    await this.auditService.log('REPORT_GENERATED', {
      userId,
      resourceType: 'report',
      details: { type: filters.type, period: filters.period },
    });

    return {
      metadata: {
        type: filters.type,
        generatedAt: new Date().toISOString(),
        period: { start: dateRange.start, end: dateRange.end },
        generatedBy: userId,
      },
      data: report,
    };
  }

  private async generateExecutiveSummary(dateRange: DateRange) {
    const [
      totalIncidents,
      incidentsBySeverity,
      incidentsByStatus,
      totalAlerts,
      resolvedIncidents,
      mttdData,
      mttrData,
    ] = await Promise.all([
      this.prisma.incident.count({
        where: { detectedAt: { gte: dateRange.start, lte: dateRange.end } },
      }),
      this.prisma.incident.groupBy({
        by: ['severity'],
        _count: true,
        where: { detectedAt: { gte: dateRange.start, lte: dateRange.end } },
      }),
      this.prisma.incident.groupBy({
        by: ['status'],
        _count: true,
        where: { detectedAt: { gte: dateRange.start, lte: dateRange.end } },
      }),
      this.prisma.alert.count({
        where: { timestamp: { gte: dateRange.start, lte: dateRange.end } },
      }),
      this.prisma.incident.count({
        where: {
          detectedAt: { gte: dateRange.start, lte: dateRange.end },
          status: { in: ['recovered', 'closed'] },
        },
      }),
      this.prisma.incident.findMany({
        where: {
          detectedAt: { gte: dateRange.start, lte: dateRange.end },
          acknowledgedAt: { not: null },
        },
        select: { detectedAt: true, acknowledgedAt: true },
      }),
      this.prisma.incident.findMany({
        where: {
          detectedAt: { gte: dateRange.start, lte: dateRange.end },
          resolvedAt: { not: null },
        },
        select: { detectedAt: true, resolvedAt: true },
      }),
    ]);

    // Calculate MTTD (Mean Time to Detect → Acknowledge)
    const mttd = mttdData.length > 0
      ? mttdData.reduce((sum, inc) => {
          return sum + (inc.acknowledgedAt!.getTime() - inc.detectedAt.getTime());
        }, 0) / mttdData.length / 60000 // Convert to minutes
      : 0;

    // Calculate MTTR (Mean Time to Resolve)
    const mttr = mttrData.length > 0
      ? mttrData.reduce((sum, inc) => {
          return sum + (inc.resolvedAt!.getTime() - inc.detectedAt.getTime());
        }, 0) / mttrData.length / 3600000 // Convert to hours
      : 0;

    return {
      overview: {
        totalIncidents,
        totalAlerts,
        resolvedIncidents,
        resolutionRate: totalIncidents > 0
          ? Math.round((resolvedIncidents / totalIncidents) * 100)
          : 0,
      },
      severity: incidentsBySeverity.reduce(
        (acc, item) => ({ ...acc, [item.severity]: item._count }),
        {},
      ),
      status: incidentsByStatus.reduce(
        (acc, item) => ({ ...acc, [item.status]: item._count }),
        {},
      ),
      kpis: {
        mttd: Math.round(mttd * 100) / 100, // minutes
        mttr: Math.round(mttr * 100) / 100, // hours
        alertToIncidentRatio: totalAlerts > 0
          ? Math.round((totalIncidents / totalAlerts) * 100) / 100
          : 0,
      },
    };
  }

  private async generateIncidentReport(dateRange: DateRange, incidentId?: string) {
    if (incidentId) {
      const incident = await this.prisma.incident.findUnique({
        where: { id: incidentId },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          alerts: { orderBy: { timestamp: 'desc' }, take: 50 },
        },
      });

      if (!incident) {
        throw new NotFoundException(`Incident not found: ${incidentId}`);
      }

      return {
        incident,
        timeline: this.buildIncidentTimeline(incident),
        relatedAlerts: incident.alerts.length,
      };
    }

    // General incident report for the period
    const incidents = await this.prisma.incident.findMany({
      where: { detectedAt: { gte: dateRange.start, lte: dateRange.end } },
      orderBy: { detectedAt: 'desc' },
      include: {
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { alerts: true } },
      },
    });

    return {
      total: incidents.length,
      incidents: incidents.map((inc) => ({
        id: inc.id,
        title: inc.title,
        severity: inc.severity,
        status: inc.status,
        assignedTo: inc.assignedTo?.name,
        alertCount: inc._count.alerts,
        detectedAt: inc.detectedAt,
        resolvedAt: inc.resolvedAt,
      })),
    };
  }

  private async generateThreatLandscape(dateRange: DateRange) {
    const [
      topMitreTechniques,
      topSources,
      iocsByType,
      topIps,
    ] = await Promise.all([
      this.prisma.$queryRaw`
        SELECT unnest(mitre_techniques) as technique, COUNT(*) as count
        FROM incidents
        WHERE detected_at >= ${dateRange.start} AND detected_at <= ${dateRange.end}
        GROUP BY technique
        ORDER BY count DESC
        LIMIT 10
      `,
      this.prisma.alert.groupBy({
        by: ['source'],
        _count: true,
        where: { timestamp: { gte: dateRange.start, lte: dateRange.end } },
        orderBy: { _count: { source: 'desc' } },
        take: 10,
      }),
      this.prisma.iOC.groupBy({
        by: ['type'],
        _count: true,
        where: { createdAt: { gte: dateRange.start, lte: dateRange.end } },
      }),
      this.prisma.alert.groupBy({
        by: ['srcIp'],
        _count: true,
        where: {
          timestamp: { gte: dateRange.start, lte: dateRange.end },
          srcIp: { not: null },
        },
        orderBy: { _count: { srcIp: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      mitreTechniques: topMitreTechniques,
      alertSources: topSources.map((s) => ({ source: s.source, count: s._count })),
      iocDistribution: iocsByType.reduce(
        (acc, item) => ({ ...acc, [item.type]: item._count }),
        {},
      ),
      topAttackerIps: topIps.map((ip) => ({ ip: ip.srcIp, count: ip._count })),
    };
  }

  private async generateKpiMetrics(dateRange: DateRange) {
    const incidents = await this.prisma.incident.findMany({
      where: { detectedAt: { gte: dateRange.start, lte: dateRange.end } },
      select: {
        severity: true,
        status: true,
        detectedAt: true,
        acknowledgedAt: true,
        containedAt: true,
        resolvedAt: true,
        closedAt: true,
      },
    });

    const falsePositives = incidents.filter((i) => i.status === 'false_positive').length;

    // Per-severity MTTR
    const severityMetrics = ['critical', 'high', 'medium', 'low'].map((sev) => {
      const sevIncidents = incidents.filter((i) => i.severity === sev && i.resolvedAt);
      const avgMttr = sevIncidents.length > 0
        ? sevIncidents.reduce((sum, i) => sum + (i.resolvedAt!.getTime() - i.detectedAt.getTime()), 0) /
          sevIncidents.length / 3600000
        : 0;
      return { severity: sev, count: incidents.filter((i) => i.severity === sev).length, avgMttrHours: Math.round(avgMttr * 100) / 100 };
    });

    return {
      totalIncidents: incidents.length,
      falsePositiveRate: incidents.length > 0
        ? Math.round((falsePositives / incidents.length) * 100)
        : 0,
      severityMetrics,
      slaCompliance: this.calculateSlaCompliance(incidents),
    };
  }

  private async generateComplianceReport(dateRange: DateRange) {
    const [auditLogs, userActivity, mfaStatus] = await Promise.all([
      this.prisma.auditLog.count({
        where: { timestamp: { gte: dateRange.start, lte: dateRange.end } },
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        _count: true,
        where: { timestamp: { gte: dateRange.start, lte: dateRange.end } },
        orderBy: { _count: { action: 'desc' } },
        take: 20,
      }),
      this.prisma.user.groupBy({
        by: ['mfaEnabled'],
        _count: true,
        where: { isActive: true },
      }),
    ]);

    return {
      auditTrail: {
        totalEvents: auditLogs,
        topActions: userActivity.map((a) => ({ action: a.action, count: a._count })),
      },
      accessControl: {
        mfaAdoption: mfaStatus.reduce(
          (acc, item) => ({ ...acc, [item.mfaEnabled ? 'enabled' : 'disabled']: item._count }),
          {},
        ),
      },
      dataRetention: {
        incidentsRetained: await this.prisma.incident.count(),
        alertsRetained: await this.prisma.alert.count(),
        auditLogsRetained: auditLogs,
      },
    };
  }

  private async generateAssetInventory() {
    const [total, byCriticality, byOs, byStatus, recentlyDiscovered] = await Promise.all([
      this.prisma.asset.count(),
      this.prisma.asset.groupBy({ by: ['criticality'], _count: true }),
      this.prisma.asset.groupBy({ by: ['os'], _count: true, where: { os: { not: null } } }),
      this.prisma.asset.groupBy({ by: ['isActive'], _count: true }),
      this.prisma.asset.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600000) } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, hostname: true, ipAddress: true, criticality: true, createdAt: true },
      }),
    ]);

    return {
      total,
      byCriticality: byCriticality.reduce((acc, item) => ({ ...acc, [item.criticality]: item._count }), {}),
      byOs: byOs.reduce((acc, item) => ({ ...acc, [item.os || 'unknown']: item._count }), {}),
      status: byStatus.reduce((acc, item) => ({ ...acc, [item.isActive ? 'active' : 'inactive']: item._count }), {}),
      recentlyDiscovered,
    };
  }

  private getDateRange(filters: ReportFiltersDto): DateRange {
    const end = filters.endDate ? new Date(filters.endDate) : new Date();
    let start: Date;

    switch (filters.period) {
      case ReportPeriod.LAST_24H:
        start = new Date(end.getTime() - 24 * 3600000);
        break;
      case ReportPeriod.LAST_7D:
        start = new Date(end.getTime() - 7 * 24 * 3600000);
        break;
      case ReportPeriod.LAST_30D:
        start = new Date(end.getTime() - 30 * 24 * 3600000);
        break;
      case ReportPeriod.LAST_90D:
        start = new Date(end.getTime() - 90 * 24 * 3600000);
        break;
      case ReportPeriod.CUSTOM:
        start = filters.startDate ? new Date(filters.startDate) : new Date(end.getTime() - 7 * 24 * 3600000);
        break;
      default:
        start = new Date(end.getTime() - 7 * 24 * 3600000);
    }

    return { start, end };
  }

  private buildIncidentTimeline(incident: any) {
    const events: { timestamp: Date; event: string }[] = [];

    if (incident.detectedAt) events.push({ timestamp: incident.detectedAt, event: 'Detected' });
    if (incident.acknowledgedAt) events.push({ timestamp: incident.acknowledgedAt, event: 'Acknowledged' });
    if (incident.containedAt) events.push({ timestamp: incident.containedAt, event: 'Contained' });
    if (incident.resolvedAt) events.push({ timestamp: incident.resolvedAt, event: 'Resolved' });
    if (incident.closedAt) events.push({ timestamp: incident.closedAt, event: 'Closed' });

    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private calculateSlaCompliance(incidents: any[]) {
    // SLA targets: Critical=4h, High=8h, Medium=24h, Low=72h
    const slaTargets = { critical: 4, high: 8, medium: 24, low: 72 };
    const results: Record<string, { total: number; compliant: number; rate: number }> = {};

    for (const [severity, targetHours] of Object.entries(slaTargets)) {
      const sevIncidents = incidents.filter(
        (i) => i.severity === severity && i.resolvedAt,
      );
      const compliant = sevIncidents.filter((i) => {
        const responseTime = (i.resolvedAt.getTime() - i.detectedAt.getTime()) / 3600000;
        return responseTime <= targetHours;
      });

      results[severity] = {
        total: sevIncidents.length,
        compliant: compliant.length,
        rate: sevIncidents.length > 0
          ? Math.round((compliant.length / sevIncidents.length) * 100)
          : 100,
      };
    }

    return results;
  }
}
