import { Test, TestingModule } from '@nestjs/testing';
import { ThreatIntelService } from '../../src/threat-intel/threat-intel.service';
import { IocService } from '../../src/ioc/ioc.service';
import { AuditService } from '../../src/audit/audit.service';
import { OtxFeedService } from '../../src/threat-intel/feeds/otx-feed.service';
import { AbuseIpDbService } from '../../src/threat-intel/feeds/abuseipdb.service';
import { MispFeedService } from '../../src/threat-intel/feeds/misp-feed.service';

describe('ThreatIntelService', () => {
  let service: ThreatIntelService;
  let mockIocService: any;
  let mockAbuseIpDb: any;

  beforeEach(async () => {
    mockIocService = {
      matchValue: jest.fn().mockResolvedValue([]),
      bulkImport: jest.fn().mockResolvedValue({ created: 5, skipped: 2, errors: [] }),
    };

    mockAbuseIpDb = {
      checkIp: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThreatIntelService,
        { provide: IocService, useValue: mockIocService },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: OtxFeedService, useValue: { fetchLatestPulses: jest.fn().mockResolvedValue([]) } },
        { provide: AbuseIpDbService, useValue: mockAbuseIpDb },
        { provide: MispFeedService, useValue: { fetchRecentEvents: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = module.get<ThreatIntelService>(ThreatIntelService);
  });

  describe('lookup', () => {
    it('should return unknown risk when no matches found', async () => {
      const result = await service.lookup('8.8.8.8');

      expect(result.value).toBe('8.8.8.8');
      expect(result.knownIoc).toBe(false);
      expect(result.riskLevel).toBe('unknown');
    });

    it('should flag as known IOC when found in local DB', async () => {
      mockIocService.matchValue.mockResolvedValue([
        { id: 'ioc-1', type: 'ip', value: '1.2.3.4', severity: 'high', confidence: 90 },
      ]);

      const result = await service.lookup('1.2.3.4');

      expect(result.knownIoc).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.sources).toContain('local_ioc_db');
    });

    it('should check AbuseIPDB for IP addresses', async () => {
      mockAbuseIpDb.checkIp.mockResolvedValue({
        ipAddress: '5.6.7.8',
        abuseConfidenceScore: 85,
        totalReports: 150,
        countryCode: 'RU',
      });

      const result = await service.lookup('5.6.7.8');

      expect(result.sources).toContain('abuseipdb');
      expect(result.abuseIpDb).toBeDefined();
      expect(result.riskLevel).toBe('high'); // score >= 80
    });

    it('should NOT check AbuseIPDB for non-IP values', async () => {
      await service.lookup('evil-domain.com');

      expect(mockAbuseIpDb.checkIp).not.toHaveBeenCalled();
    });

    it('should escalate risk level correctly', async () => {
      mockIocService.matchValue.mockResolvedValue([
        { severity: 'medium', confidence: 70 },
      ]);
      mockAbuseIpDb.checkIp.mockResolvedValue({
        abuseConfidenceScore: 95,
      });

      const result = await service.lookup('10.0.0.1');

      // medium from IOC, but AbuseIPDB score >= 80 escalates to high
      expect(result.riskLevel).toBe('high');
    });
  });

  describe('enrichAlert', () => {
    it('should enrich srcIp and dstIp independently', async () => {
      mockIocService.matchValue.mockResolvedValue([]);

      const result = await service.enrichAlert({
        srcIp: '1.2.3.4',
        dstIp: '5.6.7.8',
      });

      expect(result.srcIp).toBeDefined();
      expect(result.dstIp).toBeDefined();
    });

    it('should handle partial alert data', async () => {
      const result = await service.enrichAlert({ srcIp: '1.2.3.4' });

      expect(result.srcIp).toBeDefined();
      expect(result.dstIp).toBeUndefined();
      expect(result.domain).toBeUndefined();
    });
  });

  describe('syncFeeds', () => {
    it('should return sync results with counts', async () => {
      const result = await service.syncFeeds();

      expect(result).toHaveProperty('otx');
      expect(result).toHaveProperty('misp');
      expect(result).toHaveProperty('errors');
    });
  });
});
