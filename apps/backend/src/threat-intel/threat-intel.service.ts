import { Injectable, Logger } from '@nestjs/common';
import { IocService } from '../ioc/ioc.service';
import { AuditService } from '../audit/audit.service';
import { OtxFeedService } from './feeds/otx-feed.service';
import { AbuseIpDbService } from './feeds/abuseipdb.service';
import { MispFeedService } from './feeds/misp-feed.service';
import { StixTaxiiService } from './feeds/stix-taxii.service';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

// ─────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────

export interface ProviderResult {
  status: 'fulfilled' | 'rejected';
  data?: any;
  error?: string;
}

export interface ThreatLookupResult {
  ioc: string;
  type: 'ip' | 'domain' | 'hash' | 'url' | 'unknown';
  malicious: boolean;
  confidence: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  sources: {
    misp_local: ProviderResult;
    abuseipdb: ProviderResult;
    otx: ProviderResult;
    stix_taxii: ProviderResult;
  };
  localIocMatch?: any;
}

export interface AlertEnrichmentResult {
  srcIp?: ThreatLookupResult;
  dstIp?: ThreatLookupResult;
  domain?: ThreatLookupResult;
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

@Injectable()
export class ThreatIntelService {
  private readonly logger = new Logger(ThreatIntelService.name);

  constructor(
    private readonly iocService: IocService,
    private readonly auditService: AuditService,
    private readonly otxFeed: OtxFeedService,
    private readonly abuseIpDb: AbuseIpDbService,
    private readonly mispFeed: MispFeedService,
    private readonly stixTaxii: StixTaxiiService,
    private readonly configService: ConfigService,
  ) {}

  // ─────────────────────────────────────────────────────────
  // REAL-TIME LOOKUP — All 4 providers in parallel
  // ─────────────────────────────────────────────────────────

  /**
   * Lookup an IOC (IP/domain/hash) against ALL threat intel sources in parallel.
   * Uses Promise.allSettled for fault isolation — one provider failing
   * does NOT block the others.
   */
  async lookup(value: string): Promise<ThreatLookupResult> {
    const iocType = this.detectIocType(value);

    // Execute all 4 provider lookups in parallel with fault isolation
    const [mispResult, abuseipdbResult, otxResult, stixResult] = await Promise.allSettled([
      this.lookupMisp(value, iocType),
      this.lookupAbuseIpDb(value, iocType),
      this.lookupOtx(value, iocType),
      this.lookupStixTaxii(value, iocType),
    ]);

    // Also check local IOC database
    let localIocMatch: any = null;
    try {
      const localMatches = await this.iocService.matchValue(value);
      if (localMatches.length > 0) {
        localIocMatch = localMatches[0];
      }
    } catch (error) {
      this.logger.warn(`Local IOC DB lookup failed: ${error.message}`);
    }

    // Build structured response
    const sources = {
      misp_local: this.formatProviderResult(mispResult),
      abuseipdb: this.formatProviderResult(abuseipdbResult),
      otx: this.formatProviderResult(otxResult),
      stix_taxii: this.formatProviderResult(stixResult),
    };

    // Calculate aggregate confidence and malicious flag
    const { malicious, confidence, riskLevel } = this.aggregateResults(
      sources,
      localIocMatch,
    );

    return {
      ioc: value,
      type: iocType,
      malicious,
      confidence,
      riskLevel,
      sources,
      localIocMatch,
    };
  }

  /**
   * Enrich an alert with threat intelligence context from all providers.
   */
  async enrichAlert(alertData: {
    srcIp?: string;
    dstIp?: string;
    domain?: string;
  }): Promise<AlertEnrichmentResult> {
    const enrichments: AlertEnrichmentResult = {};

    // Run enrichments in parallel for all available IOCs
    const tasks: Array<{ key: keyof AlertEnrichmentResult; value: string }> = [];
    if (alertData.srcIp) tasks.push({ key: 'srcIp', value: alertData.srcIp });
    if (alertData.dstIp) tasks.push({ key: 'dstIp', value: alertData.dstIp });
    if (alertData.domain) tasks.push({ key: 'domain', value: alertData.domain });

    const results = await Promise.allSettled(
      tasks.map((t) => this.lookup(t.value)),
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        enrichments[tasks[index].key] = result.value;
      } else {
        this.logger.warn(
          `Enrichment failed for ${tasks[index].key}=${tasks[index].value}: ${result.reason}`,
        );
      }
    });

    return enrichments;
  }

  // ─────────────────────────────────────────────────────────
  // Individual Provider Lookups (with timeout & error handling)
  // ─────────────────────────────────────────────────────────

  /**
   * MISP Local — REST /events/restSearch
   * Searches for attributes matching the IOC value.
   */
  private async lookupMisp(
    value: string,
    _type: string,
  ): Promise<{ events_count: number; threat_level: string; event_ids: string[] }> {
    const mispUrl = this.configService.get<string>('MISP_URL', '');
    const mispApiKey = this.configService.get<string>('MISP_API_KEY', '');

    if (!mispUrl || !mispApiKey) {
      throw new Error('MISP not configured (MISP_URL or MISP_API_KEY missing)');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(`${mispUrl}/events/restSearch`, {
        method: 'POST',
        headers: {
          Authorization: mispApiKey,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          value,
          type_attribute: this.getMispSearchTypes(value),
          enforceWarninglist: true,
          limit: 10,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`MISP returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const events = data.response?.map((r: any) => r.Event) || [];

      const threatLevel =
        events.length > 0
          ? this.mapMispThreatLevel(events[0].threat_level_id)
          : 'None';

      return {
        events_count: events.length,
        threat_level: threatLevel,
        event_ids: events.map((e: any) => e.id),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * AbuseIPDB — Check IP reputation (only for IP addresses)
   */
  private async lookupAbuseIpDb(
    value: string,
    type: string,
  ): Promise<{ score: number; reports: number; country: string; categories: number[] } | null> {
    if (type !== 'ip') {
      return null; // AbuseIPDB only supports IP lookups
    }

    const report = await this.abuseIpDb.checkIp(value);
    if (!report) {
      throw new Error('AbuseIPDB returned no data or API key not configured');
    }

    return {
      score: report.abuseConfidenceScore,
      reports: report.totalReports,
      country: report.countryCode,
      categories: report.categories,
    };
  }

  /**
   * AlienVault OTX — Check indicators (IP/Domain/Hash)
   */
  private async lookupOtx(
    value: string,
    type: string,
  ): Promise<{ pulse_count: number; tags: string[]; first_seen?: string }> {
    const otxApiKey = this.configService.get<string>('OTX_API_KEY', '');
    if (!otxApiKey) {
      throw new Error('OTX API key not configured');
    }

    const endpoint = this.getOtxEndpoint(value, type);
    if (!endpoint) {
      throw new Error(`OTX does not support lookup for type: ${type}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(endpoint, {
        headers: { 'X-OTX-API-KEY': otxApiKey },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`OTX returned HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        pulse_count: data.pulse_info?.count ?? data.count ?? 0,
        tags: data.pulse_info?.pulses?.flatMap((p: any) => p.tags || [])?.slice(0, 10) || [],
        first_seen: data.first_seen || undefined,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * STIX/TAXII 2.1 — Search configured TAXII feeds for matching indicators
   */
  private async lookupStixTaxii(
    value: string,
    _type: string,
  ): Promise<{ matches: number; sources: string[] }> {
    const taxiiUrl = this.configService.get<string>('TAXII_URL', '');
    const taxiiApiRoot = this.configService.get<string>('TAXII_API_ROOT', '');
    const taxiiCollectionId = this.configService.get<string>('TAXII_COLLECTION_ID', '');

    if (!taxiiUrl || !taxiiApiRoot || !taxiiCollectionId) {
      throw new Error('STIX/TAXII not configured (TAXII_URL, TAXII_API_ROOT, or TAXII_COLLECTION_ID missing)');
    }

    const taxiiUser = this.configService.get<string>('TAXII_USERNAME', '');
    const taxiiPass = this.configService.get<string>('TAXII_PASSWORD', '');

    // Poll last 7 days of indicators and match against the IOC value
    const addedAfter = new Date(Date.now() - 7 * 24 * 3600000).toISOString();

    const bundle = await this.stixTaxii.pollCollection(
      taxiiUrl,
      taxiiApiRoot,
      taxiiCollectionId,
      {
        addedAfter,
        type: ['indicator'],
        credentials: taxiiUser ? { user: taxiiUser, password: taxiiPass } : undefined,
      },
    );

    if (!bundle || !bundle.objects?.length) {
      return { matches: 0, sources: [] };
    }

    // Search for the value in STIX patterns
    const matchingObjects = bundle.objects.filter(
      (obj) => obj.pattern && obj.pattern.includes(value),
    );

    return {
      matches: matchingObjects.length,
      sources: matchingObjects.map((obj) => obj.id),
    };
  }

  // ─────────────────────────────────────────────────────────
  // Feed Sync (Cron — every 4 hours)
  // ─────────────────────────────────────────────────────────

  /**
   * Sync all threat intel feeds to populate local IOC database.
   * Uses Promise.allSettled so one feed failure does not block others.
   */
  @Cron(CronExpression.EVERY_4_HOURS)
  async syncFeeds() {
    this.logger.log('Starting threat intel feed sync...');

    const [otxResult, mispResult] = await Promise.allSettled([
      this.syncOtxFeed(),
      this.syncMispFeed(),
    ]);

    const results = {
      otx: otxResult.status === 'fulfilled' ? otxResult.value : 0,
      misp: mispResult.status === 'fulfilled' ? mispResult.value : 0,
      errors: [] as string[],
    };

    if (otxResult.status === 'rejected') {
      results.errors.push(`OTX: ${otxResult.reason}`);
      this.logger.error(`OTX sync failed: ${otxResult.reason}`);
    }
    if (mispResult.status === 'rejected') {
      results.errors.push(`MISP: ${mispResult.reason}`);
      this.logger.error(`MISP sync failed: ${mispResult.reason}`);
    }

    this.logger.log(
      `Feed sync complete: OTX=${results.otx}, MISP=${results.misp}, errors=${results.errors.length}`,
    );
    return results;
  }

  private async syncOtxFeed(): Promise<number> {
    const otxIocs = await this.otxFeed.fetchLatestPulses();
    if (otxIocs.length > 0) {
      const importResult = await this.iocService.bulkImport(otxIocs, 'system');
      return importResult.created;
    }
    return 0;
  }

  private async syncMispFeed(): Promise<number> {
    const mispIocs = await this.mispFeed.fetchRecentEvents();
    if (mispIocs.length > 0) {
      const importResult = await this.iocService.bulkImport(mispIocs, 'system');
      return importResult.created;
    }
    return 0;
  }

  // ─────────────────────────────────────────────────────────
  // Feed Status
  // ─────────────────────────────────────────────────────────

  async getFeedStatus() {
    return {
      feeds: [
        {
          name: 'MISP Local',
          enabled: !!(
            this.configService.get('MISP_URL') &&
            this.configService.get('MISP_API_KEY')
          ),
          lastSync: null,
        },
        {
          name: 'AbuseIPDB',
          enabled: !!this.configService.get('ABUSEIPDB_API_KEY'),
          lastSync: null,
        },
        {
          name: 'AlienVault OTX',
          enabled: !!this.configService.get('OTX_API_KEY'),
          lastSync: null,
        },
        {
          name: 'STIX/TAXII 2.1',
          enabled: !!(
            this.configService.get('TAXII_URL') &&
            this.configService.get('TAXII_COLLECTION_ID')
          ),
          lastSync: null,
        },
      ],
      nextSync: this.getNextSyncTime(),
    };
  }

  // ─────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────

  private formatProviderResult(
    settled: PromiseSettledResult<any>,
  ): ProviderResult {
    if (settled.status === 'fulfilled') {
      return { status: 'fulfilled', data: settled.value };
    }
    return {
      status: 'rejected',
      error: settled.reason?.message || String(settled.reason),
    };
  }

  /**
   * Aggregate results from all providers to determine malicious flag,
   * confidence score, and risk level.
   */
  private aggregateResults(
    sources: ThreatLookupResult['sources'],
    localIocMatch: any,
  ): { malicious: boolean; confidence: number; riskLevel: ThreatLookupResult['riskLevel'] } {
    let totalScore = 0;
    let maxScore = 0;
    let activeSources = 0;

    // Local IOC DB match
    if (localIocMatch) {
      totalScore += 90;
      maxScore = 90;
      activeSources++;
    }

    // MISP Local
    if (sources.misp_local.status === 'fulfilled' && sources.misp_local.data) {
      activeSources++;
      const eventsCount = sources.misp_local.data.events_count || 0;
      if (eventsCount > 0) {
        const mispScore = Math.min(70 + eventsCount * 10, 100);
        totalScore += mispScore;
        maxScore = Math.max(maxScore, mispScore);
      }
    }

    // AbuseIPDB
    if (sources.abuseipdb.status === 'fulfilled' && sources.abuseipdb.data) {
      activeSources++;
      const abuseScore = sources.abuseipdb.data.score || 0;
      if (abuseScore > 0) {
        totalScore += abuseScore;
        maxScore = Math.max(maxScore, abuseScore);
      }
    }

    // OTX
    if (sources.otx.status === 'fulfilled' && sources.otx.data) {
      activeSources++;
      const pulseCount = sources.otx.data.pulse_count || 0;
      if (pulseCount > 0) {
        const otxScore = Math.min(50 + pulseCount * 5, 95);
        totalScore += otxScore;
        maxScore = Math.max(maxScore, otxScore);
      }
    }

    // STIX/TAXII
    if (sources.stix_taxii.status === 'fulfilled' && sources.stix_taxii.data) {
      activeSources++;
      const matches = sources.stix_taxii.data.matches || 0;
      if (matches > 0) {
        const stixScore = Math.min(60 + matches * 15, 95);
        totalScore += stixScore;
        maxScore = Math.max(maxScore, stixScore);
      }
    }

    // Calculate weighted confidence
    const confidence =
      activeSources > 0 ? Math.round(totalScore / activeSources) : 0;

    // Determine malicious flag (any source with significant score)
    const malicious = maxScore >= 50;

    // Determine risk level based on max score
    let riskLevel: ThreatLookupResult['riskLevel'] = 'unknown';
    if (maxScore >= 90) riskLevel = 'critical';
    else if (maxScore >= 70) riskLevel = 'high';
    else if (maxScore >= 50) riskLevel = 'medium';
    else if (maxScore > 0) riskLevel = 'low';

    return { malicious, confidence, riskLevel };
  }

  private detectIocType(value: string): ThreatLookupResult['type'] {
    // IPv4
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) return 'ip';
    // IPv6
    if (/^([0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}$/.test(value)) return 'ip';
    // URL
    if (/^https?:\/\//i.test(value)) return 'url';
    // Hash (MD5, SHA1, SHA256)
    if (/^[a-fA-F0-9]{32}$/.test(value)) return 'hash';
    if (/^[a-fA-F0-9]{40}$/.test(value)) return 'hash';
    if (/^[a-fA-F0-9]{64}$/.test(value)) return 'hash';
    // Domain
    if (/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) return 'domain';
    return 'unknown';
  }

  private getMispSearchTypes(value: string): string[] {
    const type = this.detectIocType(value);
    switch (type) {
      case 'ip':
        return ['ip-src', 'ip-dst'];
      case 'domain':
        return ['domain', 'hostname'];
      case 'hash':
        if (value.length === 32) return ['md5'];
        if (value.length === 40) return ['sha1'];
        if (value.length === 64) return ['sha256'];
        return ['md5', 'sha1', 'sha256'];
      case 'url':
        return ['url'];
      default:
        return [];
    }
  }

  private getOtxEndpoint(value: string, type: string): string | null {
    const baseUrl = 'https://otx.alienvault.com/api/v1/indicators';
    switch (type) {
      case 'ip':
        return `${baseUrl}/IPv4/${value}/general`;
      case 'domain':
        return `${baseUrl}/domain/${value}/general`;
      case 'hash':
        return `${baseUrl}/file/${value}/general`;
      case 'url':
        return `${baseUrl}/url/${encodeURIComponent(value)}/general`;
      default:
        return null;
    }
  }

  private mapMispThreatLevel(level: string): string {
    switch (level) {
      case '1':
        return 'High';
      case '2':
        return 'Medium';
      case '3':
        return 'Low';
      case '4':
        return 'Undefined';
      default:
        return 'Unknown';
    }
  }

  private getNextSyncTime(): string {
    const now = new Date();
    const next = new Date(now);
    next.setHours(next.getHours() + (4 - (next.getHours() % 4)), 0, 0, 0);
    return next.toISOString();
  }
}
