import { Controller, Get, Post, Query, Res, UseGuards, Header } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportFiltersDto, ReportFormat } from './dto/report-filters.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('generate')
  @Roles('admin', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'Generate a report' })
  @ApiResponse({ status: 200, description: 'Report generated' })
  async generate(
    @Query() filters: ReportFiltersDto,
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const report = await this.reportsService.generate(filters, userId);

    switch (filters.format) {
      case ReportFormat.CSV:
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="report-${filters.type}-${Date.now()}.csv"`,
        );
        return this.convertToCsv(report.data);

      case ReportFormat.PDF:
        // PDF generation would use a library like puppeteer or pdfkit
        // For now, return JSON with a note
        return {
          ...report,
          note: 'PDF export requires puppeteer setup - see docs',
        };

      case ReportFormat.JSON:
      default:
        return report;
    }
  }

  @Get('types')
  @Roles('admin', 'analyst_l1', 'analyst_l2', 'analyst_l3')
  @ApiOperation({ summary: 'List available report types' })
  getReportTypes() {
    return [
      {
        type: 'executive_summary',
        description: 'High-level overview for management',
        roles: ['admin', 'analyst_l3'],
      },
      {
        type: 'incident_report',
        description: 'Detailed incident analysis',
        roles: ['admin', 'analyst_l2', 'analyst_l3'],
      },
      {
        type: 'threat_landscape',
        description: 'Threat landscape and trends',
        roles: ['admin', 'analyst_l2', 'analyst_l3'],
      },
      {
        type: 'kpi_metrics',
        description: 'SOC performance metrics (MTTD, MTTR, SLA)',
        roles: ['admin', 'analyst_l2', 'analyst_l3'],
      },
      { type: 'compliance', description: 'Compliance and audit report', roles: ['admin'] },
      {
        type: 'asset_inventory',
        description: 'Asset inventory overview',
        roles: ['admin', 'analyst_l2', 'analyst_l3'],
      },
    ];
  }

  private convertToCsv(data: any): string {
    if (Array.isArray(data)) {
      if (data.length === 0) return '';
      const headers = Object.keys(data[0]);
      const rows = data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(','));
      return [headers.join(','), ...rows].join('\n');
    }

    // For object data, flatten to key-value pairs
    const entries = Object.entries(data).map(([key, value]) => ({
      metric: key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    }));
    return this.convertToCsv(entries);
  }
}
