import { Injectable, Logger } from '@nestjs/common';
import { IocService } from '../ioc/ioc.service';
import { AuditService } from '../audit/audit.service';
import { OtxFeedService } from './feeds/otx-feed.service';
import { AbuseIpDbService } from './feeds/abuseipdb.service';
import { MispFeedService } from './feeds/misp-feed.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface ThreatLookupResult {
  value: string;
  knownIoc: boolean;
  iocDetails?: any;
  abuseIpDb?: any;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  sources: string[];
}

@Injectable()
export class ThreatIntelService {
  private readonly logger = new Logger(ThreatIntelService.name);

  constructor(
    private readonly iocService: IocService,
    private readonly auditService: AuditService,
    private readonly otxFeed: OtxFeedService,
    private readonly abuseIpDb: AbuseIpDbService,
    private readonly mispFeed: MispFeedService,
  ) {}

  /**
   * Lookup an IP/domain/hash against all threat intel sources
   */
  async lookup(value: string): Promise<ThreatLookupResult> {
    const result: ThreatLookupResult = {
      value,
      knownIoc: false,
      riskLevel: 'unknown',
      sources: [],
    };

    // Check local IOC database
    const localMatches = await this.iocService.matchValue(value);
    if (localMatches.length > 0) {
      result.knownIoc = true;
      result.iocDetails = localMatches[0];
      const severity = localMatches[0].severity;
      result.riskLevel =
        severity === 'informational'
          ? 'low'
          : (severity as 'critical' | 'high' | 'medium' | 'low' | 'unknown');
      result.sources.push('local_ioc_db');
    }

    // Check AbuseIPDB (only for IPs)
    if (this.isIpAddress(value)) {
      const abuseReport = await this.abuseIpDb.checkIp(value);
      if (abuseReport) {
        result.abuseIpDb = abuseReport;
        result.sources.push('abuseipdb');

        if (abuseReport.abuseConfidenceScore >= 80) {
          result.riskLevel = this.escalateRisk(result.riskLevel, 'high');
        } else if (abuseReport.abuseConfidenceScore >= 50) {
          result.riskLevel = this.escalateRisk(result.riskLevel, 'medium');
        }
      }
    }

    return result;
  }

  /**
   * Enrich an alert with threat intelligence context
   */
  async enrichAlert(alertData: { srcIp?: string; dstIp?: string; domain?: string }) {
    const enrichments: Record<string, ThreatLookupResult> = {};

    if (alertData.srcIp) {
      enrichments.srcIp = await this.lookup(alertData.srcIp);
    }
    if (alertData.dstIp) {
      enrichments.dstIp = await this.lookup(alertData.dstIp);
    }
    if (alertData.domain) {
      enrichments.domain = await this.lookup(alertData.domain);
    }

    return enrichments;
  }

  /**
   * Sync all threat intel feeds (runs every 4 hours)
   */
  @Cron(CronExpression.EVERY_4_HOURS)
  async syncFeeds() {
    this.logger.log('Starting threat intel feed sync...');

    const results = { otx: 0, misp: 0, errors: [] as string[] };

    try {
      // Sync OTX
      const otxIocs = await this.otxFeed.fetchLatestPulses();
      if (otxIocs.length > 0) {
        const importResult = await this.iocService.bulkImport(otxIocs, 'system');
        results.otx = importResult.created;
      }

      // Sync MISP
      const mispIocs = await this.mispFeed.fetchRecentEvents();
      if (mispIocs.length > 0) {
        const importResult = await this.iocService.bulkImport(mispIocs, 'system');
        results.misp = importResult.created;
      }

      this.logger.log(`Feed sync complete: OTX=${results.otx}, MISP=${results.misp}`);
    } catch (error) {
      this.logger.error(`Feed sync failed: ${error.message}`);
      results.errors.push(error.message);
    }

    return results;
  }

  /**
   * Get feed status and last sync info
   */
  async getFeedStatus() {
    return {
      feeds: [
        { name: 'AlienVault OTX', enabled: !!process.env.OTX_API_KEY, lastSync: null },
        { name: 'AbuseIPDB', enabled: !!process.env.ABUSEIPDB_API_KEY, lastSync: null },
        {
          name: 'MISP',
          enabled: !!(process.env.MISP_URL && process.env.MISP_API_KEY),
          lastSync: null,
        },
      ],
      nextSync: this.getNextSyncTime(),
    };
  }

  private isIpAddress(value: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(value) || ipv6Regex.test(value);
  }

  private escalateRisk(
    current: string,
    proposed: string,
  ): 'critical' | 'high' | 'medium' | 'low' | 'unknown' {
    const levels = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };
    const currentLevel = levels[current] || 0;
    const proposedLevel = levels[proposed] || 0;
    return proposedLevel > currentLevel ? (proposed as any) : (current as any);
  }

  private getNextSyncTime(): string {
    const now = new Date();
    const next = new Date(now);
    next.setHours(next.getHours() + (4 - (next.getHours() % 4)), 0, 0, 0);
    return next.toISOString();
  }
}
