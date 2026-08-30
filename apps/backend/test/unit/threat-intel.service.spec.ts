import { Injectable, Logger } from '@nestjs/common';
import { IocService } from '../../src/ioc/ioc.service';
import { AuditService } from '../../src/audit/audit.service';
import { OtxFeedService } from '../../src/threat-intel/feeds/otx-feed.service';
import { AbuseIpDbService } from '../../src/threat-intel/feeds/abuseipdb.service';
import { MispFeedService } from '../../src/threat-intel/feeds/misp-feed.service';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical' | 'unknown';

export interface ThreatLookupResult {
  value: string;
  knownIoc: boolean;
  riskLevel: RiskLevel;
  sources: string[];
  localIocs?: any[];
  abuseIpDb?: {
    ipAddress?: string;
    abuseConfidenceScore?: number;
    totalReports?: number;
    countryCode?: string;
    [key: string]: any;
  } | null;
  [key: string]: any;
}

export interface EnrichedAlert {
  srcIp?: ThreatLookupResult;
  dstIp?: ThreatLookupResult;
  domain?: ThreatLookupResult;
  hash?: ThreatLookupResult;
  [key: string]: any;
}

export interface SyncFeedsResult {
  otx: { created: number; skipped: number; errors: string[] };
  misp: { created: number; skipped: number; errors: string[] };
  errors: string[];
}

@Injectable()
export class ThreatIntelService {
  private readonly logger = new Logger(ThreatIntelService.name);

  constructor(
    private readonly iocService: IocService,
    private readonly auditService: AuditService,
    private readonly otxFeedService: OtxFeedService,
    private readonly abuseIpDbService: AbuseIpDbService,
    private readonly mispFeedService: MispFeedService,
  ) {}

  /**
   * Helper pour vérifier si la chaîne est une adresse IP V4 valide
   */
  private isIpAddress(value: string): boolean {
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    return ipRegex.test(value);
  }

  /**
   * Interroge les bases locales et externes (AbuseIPDB) pour enrichir une valeur
   */
  async lookup(value: string): Promise<ThreatLookupResult> {
    const sources: string[] = [];
    let knownIoc = false;
    let riskLevel: RiskLevel = 'unknown';

    // 1. Recherche dans la base d'IOCs locale
    const localIocs = await this.iocService.matchValue(value);
    if (localIocs && localIocs.length > 0) {
      knownIoc = true;
      sources.push('local_ioc_db');

      // Déduire le niveau de risque initial basé sur l'IOC local
      const highestSeverity = localIocs.reduce((max, ioc) => {
        const severityMap: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
        const currentScore = severityMap[ioc.severity] || 0;
        const maxScore = severityMap[max] || 0;
        return currentScore > maxScore ? ioc.severity : max;
      }, 'low');

      riskLevel = (highestSeverity as RiskLevel) || 'low';
    }

    // 2. Interrogation AbuseIPDB (uniquement si c'est une adresse IP)
    let abuseIpDbResult: ThreatLookupResult['abuseIpDb'] = null;
    if (this.isIpAddress(value)) {
      try {
        const check = await this.abuseIpDbService.checkIp(value);
        if (check) {
          abuseIpDbResult = check;
          sources.push('abuseipdb');

          // Escalade du niveau de risque si le score AbuseIPDB est >= 80
          if (check.abuseConfidenceScore && check.abuseConfidenceScore >= 80) {
            riskLevel = 'high';
          } else if (check.abuseConfidenceScore && check.abuseConfidenceScore >= 40 && riskLevel === 'unknown') {
            riskLevel = 'medium';
          }
        }
      } catch (error) {
        this.logger.warn(`Failed AbuseIPDB lookup for ${value}: ${error instanceof Error ? error.message : error}`);
      }
    }

    return {
      value,
      knownIoc,
      riskLevel,
      sources,
      localIocs,
      abuseIpDb: abuseIpDbResult,
    };
  }

  /**
   * Enrichit les différents champs (srcIp, dstIp, domain) d'une alerte
   */
  async enrichAlert(alertData: { srcIp?: string; dstIp?: string; domain?: string; hash?: string }): Promise<EnrichedAlert> {
    const result: EnrichedAlert = {};

    if (alertData.srcIp) {
      result.srcIp = await this.lookup(alertData.srcIp);
    }
    if (alertData.dstIp) {
      result.dstIp = await this.lookup(alertData.dstIp);
    }
    if (alertData.domain) {
      result.domain = await this.lookup(alertData.domain);
    }
    if (alertData.hash) {
      result.hash = await this.lookup(alertData.hash);
    }

    return result;
  }

  /**
   * Synchronise les flux OTX et MISP
   */
  async syncFeeds(): Promise<SyncFeedsResult> {
    const errors: string[] = [];
    let otxResult = { created: 0, skipped: 0, errors: [] };
    let mispResult = { created: 0, skipped: 0, errors: [] };

    try {
      const otxPulses = await this.otxFeedService.fetchLatestPulses();
      if (otxPulses && otxPulses.length > 0) {
        otxResult = await this.iocService.bulkImport(otxPulses, 'otx');
      }
    } catch (err: any) {
      const msg = `OTX sync error: ${err?.message || err}`;
      this.logger.error(msg);
      errors.push(msg);
    }

    try {
      const mispEvents = await this.mispFeedService.fetchRecentEvents();
      if (mispEvents && mispEvents.length > 0) {
        mispResult = await this.iocService.bulkImport(mispEvents, 'misp');
      }
    } catch (err: any) {
      const msg = `MISP sync error: ${err?.message || err}`;
      this.logger.error(msg);
      errors.push(msg);
    }

    await this.auditService.log('THREAT_FEEDS_SYNCED', {
      otxCount: otxResult.created,
      mispCount: mispResult.created,
      errorsCount: errors.length,
    });

    return {
      otx: otxResult,
      misp: mispResult,
      errors,
    };
  }
}