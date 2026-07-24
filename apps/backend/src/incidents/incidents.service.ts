import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { IncidentFiltersDto } from './dto/incident-filters.dto';
import { PaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateIncidentDto, userId: string) {
    const incident = await this.prisma.incident.create({
      data: {
        title: dto.title,
        description: dto.description,
        severity: dto.severity,
        status: 'new',
        category: dto.category,
        mitreTactics: dto.mitreTactics || [],
        mitreTechniques: dto.mitreTechniques || [],
        source: dto.source || 'manual',
        sourceAlertIds: dto.sourceAlertIds || [],
        riskScore: this.calculateRiskScore(dto.severity, dto.category),
        tags: dto.tags || [],
        createdById: userId,
        detectedAt: new Date(),
      },
    });

    await this.auditService.log('INCIDENT_CREATED', {
      userId,
      resourceType: 'incident',
      resourceId: incident.id,
      severity: dto.severity,
    });

    this.eventEmitter.emit('incident.created', incident);
    this.logger.log(`Incident created: ${incident.id} - ${incident.title}`);

    return incident;
  }

  async findAll(filters: IncidentFiltersDto): Promise<PaginatedResult<any>> {
    const where: any = { deletedAt: null };

    if (filters.status) where.status = filters.status;
    if (filters.severity) where.severity = filters.severity;
    if (filters.assignedTo) where.assignedToId = filters.assignedTo;
    if (filters.category) where.category = filters.category;
    if (filters.source) where.source = filters.source;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.mitreTechnique) {
      where.mitreTechniques = { has: filters.mitreTechnique };
    }
    if (filters.fromDate) {
      where.detectedAt = { ...(where.detectedAt || {}), gte: new Date(filters.fromDate) };
    }
    if (filters.toDate) {
      where.detectedAt = { ...(where.detectedAt || {}), lte: new Date(filters.toDate) };
    }

    const [incidents, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        skip: filters.skip,
        take: filters.limit,
        orderBy: { [filters.sortBy || 'detectedAt']: filters.sortOrder || 'desc' },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.incident.count({ where }),
    ]);

    return {
      data: incidents,
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

  async findById(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        escalatedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        alerts: { orderBy: { timestamp: 'desc' }, take: 50 },
      },
    });
    if (!incident || incident.deletedAt) {
      throw new NotFoundException('Incident not found');
    }
    return incident;
  }

  async update(id: string, dto: UpdateIncidentDto, userId: string) {
    const incident = await this.findById(id);
    const previousStatus = incident.status;

    const data: any = { ...dto, updatedAt: new Date() };

    // Auto-set timestamps based on status transitions
    if (dto.status && dto.status !== previousStatus) {
      switch (dto.status) {
        case 'triaged':
          data.acknowledgedAt = new Date();
          break;
        case 'contained':
          data.containedAt = new Date();
          break;
        case 'recovered':
        case 'closed':
          data.resolvedAt = new Date();
          break;
        case 'closed':
          data.closedAt = new Date();
          break;
      }
    }

    const updated = await this.prisma.incident.update({
      where: { id },
      data,
    });

    await this.auditService.log('INCIDENT_UPDATED', {
      userId,
      resourceType: 'incident',
      resourceId: id,
      changes: dto,
      previousStatus,
      newStatus: dto.status,
    });

    if (dto.status && dto.status !== previousStatus) {
      this.eventEmitter.emit('incident.status_changed', {
        incident: updated,
        previousStatus,
        newStatus: dto.status,
        userId,
      });
    }

    return updated;
  }

  async assign(id: string, assignToUserId: string, userId: string) {
    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        assignedToId: assignToUserId,
        status: 'triaged',
        acknowledgedAt: new Date(),
      },
    });

    await this.auditService.log('INCIDENT_ASSIGNED', {
      userId,
      resourceType: 'incident',
      resourceId: id,
      assignedTo: assignToUserId,
    });

    this.eventEmitter.emit('incident.assigned', { incident: updated, assignedTo: assignToUserId });
    return updated;
  }

  async escalate(id: string, escalateToUserId: string, reason: string, userId: string) {
    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        escalatedToId: escalateToUserId,
        status: 'investigating',
      },
    });

    await this.auditService.log('INCIDENT_ESCALATED', {
      userId,
      resourceType: 'incident',
      resourceId: id,
      escalatedTo: escalateToUserId,
      reason,
    });

    this.eventEmitter.emit('incident.escalated', { incident: updated, reason });
    return updated;
  }

  async close(id: string, lessonsLearned: string, userId: string) {
    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        resolvedAt: new Date(),
        lessonsLearned,
      },
    });

    await this.auditService.log('INCIDENT_CLOSED', {
      userId,
      resourceType: 'incident',
      resourceId: id,
    });

    return updated;
  }

  async softDelete(id: string, userId: string) {
    await this.prisma.incident.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log('INCIDENT_DELETED', {
      userId,
      resourceType: 'incident',
      resourceId: id,
    });
  }

  async getStatistics() {
    const [
      totalOpen,
      totalCritical,
      newAlerts24h,
      avgResponseTime,
      byStatus,
      bySeverity,
      byMitre,
      recentIncidents,
    ] = await Promise.all([
      this.prisma.incident.count({
        where: { status: { notIn: ['closed', 'false_positive'] }, deletedAt: null },
      }),
      this.prisma.incident.count({
        where: { severity: 'critical', status: { notIn: ['closed', 'false_positive'] }, deletedAt: null },
      }),
      this.prisma.alert.count({
        where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
      }),
      this.prisma.incident.aggregate({
        _avg: { riskScore: true },
        where: { deletedAt: null },
      }),
      this.prisma.incident.groupBy({
        by: ['status'],
        _count: true,
        where: { deletedAt: null },
      }),
      this.prisma.incident.groupBy({
        by: ['severity'],
        _count: true,
        where: { deletedAt: null, status: { notIn: ['closed', 'false_positive'] } },
      }),
      this.prisma.$queryRaw`
        SELECT unnest("mitre_techniques") as technique, COUNT(*) as count
        FROM incidents
        WHERE deleted_at IS NULL
        GROUP BY technique
        ORDER BY count DESC
        LIMIT 10
      `,
      this.prisma.incident.findMany({
        where: { deletedAt: null },
        orderBy: { detectedAt: 'desc' },
        take: 10,
        select: { id: true, title: true, severity: true, status: true, detectedAt: true },
      }),
    ]);

    return {
      overview: {
        openIncidents: totalOpen,
        criticalIncidents: totalCritical,
        newAlerts24h,
        avgRiskScore: Math.round(avgResponseTime._avg.riskScore || 0),
      },
      byStatus,
      bySeverity,
      topMitreTechniques: byMitre,
      recentIncidents,
    };
  }

  private calculateRiskScore(severity: string, category?: string): number {
    const severityScores: Record<string, number> = {
      critical: 90,
      high: 70,
      medium: 50,
      low: 25,
      informational: 10,
    };
    let score = severityScores[severity] || 50;

    // Bonus for certain categories
    if (category === 'ransomware' || category === 'data_breach') score += 10;
    if (category === 'apt') score += 15;

    return Math.min(score, 100);
  }
}
