import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ThreatIntelService } from '../../src/threat-intel/threat-intel.service';
import { IocService } from '../../src/ioc/ioc.service';
import { AuditService } from '../../src/audit/audit.service';
import { OtxFeedService } from '../../src/threat-intel/feeds/otx-feed.service';
import { AbuseIpDbService } from '../../src/threat-intel/feeds/abuseipdb.service';
import { MispFeedService } from '../../src/threat-intel/feeds/misp-feed.service';
import { StixTaxiiService } from '../../src/threat-intel/feeds/stix-taxii.service';

describe('ThreatIntelService', () => {
  let service: ThreatIntelService;
  let mockIocService: any;
  let mockAuditService: any;
  let mockOtxFeed: any;
  let mockAbuseIpDb: any;
  let mockMispFeed: any;
  let mockStixTaxii: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockIocService = {
      matchValue: jest.fn().mockResolvedValue([]),
      bulkImport: jest.fn().mockResolvedValue({ created: 5, skipped: 0, errors: [] }),
    };

    mockAuditService = {
      log: jest.fn(),
    };

    mockOtxFeed = {
      fetchLatestPulses: jest.fn().mockResolvedValue([]),
    };

    mockAbuseIpDb = {
      checkIp: jest.fn().mockResolvedValue(null),
    };

    mockMispFeed = {
      fetchRecentEvents: jest.fn().mockResolvedValue([]),
    };

    mockStixTaxii = {
      pollCollection: jest.fn().mockResolvedValue({ objects: [] }),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          MISP_URL: 'http://misp.local',
          MISP_API_KEY: 'misp-key',
          OTX_API_KEY: 'otx-key',
          ABUSEIPDB_API_KEY: 'abuse-key',
          TAXII_URL: 'http://taxii.local',
          TAXII_API_ROOT: 'api',
          TAXII_COLLECTION_ID: 'col-123',
        };
        return config[key] ?? defaultValue;
      }),
    };

    // Global fetch mock pour intercepter MISP et OTX
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ response: [], pulse_info: { count: 0, pulses: [] } }),
    } as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThreatIntelService,
        { provide: IocService, useValue: mockIocService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: OtxFeedService, useValue: mockOtxFeed },
        { provide: AbuseIpDbService, useValue: mockAbuseIpDb },
        { provide: MispFeedService, useValue: mockMispFeed },
        { provide: StixTaxiiService, useValue: mockStixTaxii },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ThreatIntelService>(ThreatIntelService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('lookup', () => {
    it('should return unknown risk for non-malicious IOC', async () => {
      const result = await service.lookup('8.8.8.8');

      expect(result.ioc).toBe('8.8.8.8');
      expect(result.type).toBe('ip');
      expect(result.malicious).toBe(false);
      expect(result.riskLevel).toBe('unknown');
      expect(result.sources.misp_local).toBeDefined();
      expect(result.sources.abuseipdb).toBeDefined();
      expect(result.sources.otx).toBeDefined();
      expect(result.sources.stix_taxii).toBeDefined();
    });

    it('should evaluate risk as critical when local DB matches', async () => {
      mockIocService.matchValue.mockResolvedValue([
        { id: 'ioc-1', type: 'ip', value: '1.2.3.4', severity: 'high' },
      ]);

      const result = await service.lookup('1.2.3.4');

      expect(result.ioc).toBe('1.2.3.4');
      expect(result.malicious).toBe(true);
      expect(result.riskLevel).toBe('critical');
      expect(result.localIocMatch).toBeDefined();
    });

    it('should query AbuseIPDB only for IP addresses', async () => {
      mockAbuseIpDb.checkIp.mockResolvedValue({
        abuseConfidenceScore: 80,
        totalReports: 120,
        countryCode: 'US',
        categories: [18, 22],
      });

      const ipResult = await service.lookup('1.2.3.4');
      expect(mockAbuseIpDb.checkIp).toHaveBeenCalledWith('1.2.3.4');
      expect(ipResult.sources.abuseipdb.status).toBe('fulfilled');

      mockAbuseIpDb.checkIp.mockClear();

      const domainResult = await service.lookup('malicious-domain.com');
      expect(domainResult.type).toBe('domain');
      expect(mockAbuseIpDb.checkIp).not.toHaveBeenCalled();
    });
  });

  describe('enrichAlert', () => {
    it('should enrich srcIp, dstIp and domain in parallel', async () => {
      const result = await service.enrichAlert({
        srcIp: '1.1.1.1',
        dstIp: '8.8.8.8',
        domain: 'example.com',
      });

      expect(result.srcIp).toBeDefined();
      expect(result.dstIp).toBeDefined();
      expect(result.domain).toBeDefined();
      expect(result.srcIp?.ioc).toBe('1.1.1.1');
      expect(result.domain?.type).toBe('domain');
    });
  });

  describe('syncFeeds', () => {
    it('should fetch and import feeds from OTX and MISP', async () => {
      mockOtxFeed.fetchLatestPulses.mockResolvedValue([{ type: 'ip', value: '10.0.0.1' }]);
      mockMispFeed.fetchRecentEvents.mockResolvedValue([{ type: 'domain', value: 'bad.com' }]);

      const result = await service.syncFeeds();

      expect(mockOtxFeed.fetchLatestPulses).toHaveBeenCalled();
      expect(mockMispFeed.fetchRecentEvents).toHaveBeenCalled();
      expect(mockIocService.bulkImport).toHaveBeenCalledTimes(2);
      expect(result.otx).toBe(5);
      expect(result.misp).toBe(5);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getFeedStatus', () => {
    it('should return feed availability status and next sync time', async () => {
      const status = await service.getFeedStatus();

      expect(status.feeds).toHaveLength(4);
      expect(status.nextSync).toBeDefined();
    });
  });
});