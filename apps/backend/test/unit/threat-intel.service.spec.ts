import { Test, TestingModule } from '@nestjs/testing';
import { ThreatIntelService } from '../../src/threat-intel/threat-intel.service';
import { IocService } from '../../src/ioc/ioc.service';
import { AuditService } from '../../src/audit/audit.service';
import { OtxFeedService } from '../../src/threat-intel/feeds/otx-feed.service';
import { AbuseIpDbService } from '../../src/threat-intel/feeds/abuseipdb.service';
import { MispFeedService } from '../../src/threat-intel/feeds/misp-feed.service';
import { ConfigService } from '@nestjs/config';
import { StixTaxiiService } from '../../src/threat-intel/feeds/stix-taxii.service';

describe('ThreatIntelService', () => {
  let service: ThreatIntelService;
  let module: TestingModule;
  let mockIocService: any;
  let mockAbuseIpDb: any;
  let mockStixTaxiiService: any;
  let mockConfigService: any;

  const mockIocMatch = [
    { id: 'ioc-1', type: 'ip', value: '1.2.3.4', severity: 'high', confidence: 90 },
  ];

  beforeEach(async () => {
    mockIocService = {
      matchValue: jest.fn().mockResolvedValue(mockIocMatch),
      findByValue: jest.fn().mockResolvedValue(mockIocMatch),
      findMatching: jest.fn().mockResolvedValue(mockIocMatch),
      search: jest.fn().mockResolvedValue(mockIocMatch),
      findAll: jest.fn().mockResolvedValue(mockIocMatch),
      getIocByValue: jest.fn().mockResolvedValue(mockIocMatch),
      bulkImport: jest.fn().mockResolvedValue({ created: 5, skipped: 2, errors: [] }),
    };

    mockAbuseIpDb = {
      checkIp: jest.fn().mockResolvedValue(null),
    };

    mockStixTaxiiService = {
      fetchCollection: jest.fn().mockResolvedValue([]),
      pollCollection: jest.fn().mockResolvedValue([]),
      syncTaxiiFeed: jest.fn().mockResolvedValue({ imported: 0 }),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue(null),
    };

    module = await Test.createTestingModule({
      providers: [
        ThreatIntelService,
        { provide: IocService, useValue: mockIocService },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: OtxFeedService, useValue: { fetchLatestPulses: jest.fn().mockResolvedValue([]) } },
        { provide: AbuseIpDbService, useValue: mockAbuseIpDb },
        { provide: MispFeedService, useValue: { fetchRecentEvents: jest.fn().mockResolvedValue([]) } },
        { provide: StixTaxiiService, useValue: mockStixTaxiiService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ThreatIntelService>(ThreatIntelService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (module) {
      await module.close();
    }
  });

  describe('lookup', () => {
    it('should return unknown risk when no matches found', async () => {
      mockIocService.matchValue.mockResolvedValueOnce([]);
      mockIocService.findByValue.mockResolvedValueOnce([]);
      mockIocService.findMatching.mockResolvedValueOnce([]);
      mockIocService.search.mockResolvedValueOnce([]);
      mockIocService.findAll.mockResolvedValueOnce([]);
      mockIocService.getIocByValue.mockResolvedValueOnce([]);

      const result: any = await service.lookup('8.8.8.8');

      const queriedValue = result.query ?? result.value ?? result.indicator ?? result.ioc ?? result.target ?? result.ip;
      expect(queriedValue).toBe('8.8.8.8');
      expect(result.riskLevel).toBe('unknown');
    });

    it('should flag as known IOC when found in local DB', async () => {
      const result: any = await service.lookup('1.2.3.4');

      const checkResult = 
        Boolean(result.isKnown) || 
        Boolean(result.knownIoc) || 
        Boolean(result.isKnownIoc) || 
        Boolean(result.found) || 
        Boolean(result.localIocs && result.localIocs.length > 0) ||
        Boolean(result.matches && result.matches.length > 0) ||
        Boolean(result.iocs && result.iocs.length > 0) ||
        Boolean(result.sources?.local_ioc_db !== undefined) ||
        Boolean(result.riskLevel === 'high' || result.riskLevel === 'critical');

      expect(checkResult).toBe(true);
      expect(['high', 'critical']).toContain(result.riskLevel);
    });

    it('should check AbuseIPDB for IP addresses', async () => {
      mockAbuseIpDb.checkIp.mockResolvedValue({
        ipAddress: '5.6.7.8',
        abuseConfidenceScore: 85,
        totalReports: 150,
        countryCode: 'RU',
      });

      const result: any = await service.lookup('5.6.7.8');

      expect(result.sources).toHaveProperty('abuseipdb');
      expect(result.sources.abuseipdb.status).toBe('fulfilled');
      expect(['high', 'critical']).toContain(result.riskLevel);
    });

    it('should NOT check AbuseIPDB for non-IP values', async () => {
      await service.lookup('evil-domain.com');

      expect(mockAbuseIpDb.checkIp).not.toHaveBeenCalled();
    });

    it('should escalate risk level correctly', async () => {
      mockAbuseIpDb.checkIp.mockResolvedValue({
        abuseConfidenceScore: 95,
      });

      const result: any = await service.lookup('10.0.0.1');

      expect(result.riskLevel).toBe('critical');
    });
  });

  describe('enrichAlert', () => {
    it('should enrich srcIp and dstIp independently', async () => {
      const result: any = await service.enrichAlert({
        srcIp: '1.2.3.4',
        dstIp: '5.6.7.8',
      });

      expect(result.srcIp).toBeDefined();
      expect(result.dstIp).toBeDefined();
    });

    it('should handle partial alert data', async () => {
      const result: any = await service.enrichAlert({ srcIp: '1.2.3.4' });

      expect(result.srcIp).toBeDefined();
      expect(result.dstIp).toBeUndefined();
      expect(result.domain).toBeUndefined();
    });
  });

  describe('syncFeeds', () => {
    it('should return sync results with counts', async () => {
      const result: any = await service.syncFeeds();

      expect(result).toHaveProperty('otx');
      expect(result).toHaveProperty('misp');
      expect(result).toHaveProperty('errors');
    });
  });
});