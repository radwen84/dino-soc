import { Test, TestingModule } from '@nestjs/testing';
import { StixTaxiiService, StixBundle, TlpLevel } from '../../src/threat-intel/feeds/stix-taxii.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

describe('StixTaxiiService', () => {
  let service: StixTaxiiService;
  let mockHttpService: any;

  beforeEach(async () => {
    mockHttpService = {
      get: jest.fn(),
      post: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StixTaxiiService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
      ],
    }).compile();

    service = module.get<StixTaxiiService>(StixTaxiiService);
  });

  // ─────────────────────────────────────────────────────────
  // STIX Parser
  // ─────────────────────────────────────────────────────────

  describe('parseStixBundle', () => {
    it('should parse IPv4 indicators from STIX bundle', () => {
      const bundle: StixBundle = {
        type: 'bundle',
        id: 'bundle--test',
        objects: [
          {
            type: 'indicator',
            id: 'indicator--1',
            created: '2024-01-01T00:00:00Z',
            modified: '2024-01-01T00:00:00Z',
            name: 'Malicious IP',
            description: 'Known C2 server',
            pattern: "[ipv4-addr:value = '192.168.1.100']",
            pattern_type: 'stix',
            valid_from: '2024-01-01T00:00:00Z',
            confidence: 85,
            labels: ['malicious-activity', 'TLP:GREEN'],
          },
        ],
      };

      const iocs = service.parseStixBundle(bundle, 'test-source');

      expect(iocs).toHaveLength(1);
      expect(iocs[0].type).toBe('ip');
      expect(iocs[0].value).toBe('192.168.1.100');
      expect(iocs[0].confidence).toBe(85);
      expect(iocs[0].severity).toBe('high'); // confidence 85 → high
      expect(iocs[0].source).toBe('test-source');
    });

    it('should parse domain indicators', () => {
      const bundle: StixBundle = {
        type: 'bundle',
        id: 'bundle--test',
        objects: [
          {
            type: 'indicator',
            id: 'indicator--2',
            created: '2024-01-01T00:00:00Z',
            modified: '2024-01-01T00:00:00Z',
            pattern: "[domain-name:value = 'evil.com']",
            pattern_type: 'stix',
            valid_from: '2024-01-01T00:00:00Z',
            confidence: 95,
            labels: ['TLP:AMBER'],
          },
        ],
      };

      const iocs = service.parseStixBundle(bundle, 'taxii-feed');

      expect(iocs).toHaveLength(1);
      expect(iocs[0].type).toBe('domain');
      expect(iocs[0].value).toBe('evil.com');
      expect(iocs[0].severity).toBe('critical'); // confidence 95 → critical
    });

    it('should parse multiple patterns in compound expression', () => {
      const bundle: StixBundle = {
        type: 'bundle',
        id: 'bundle--test',
        objects: [
          {
            type: 'indicator',
            id: 'indicator--3',
            created: '2024-01-01T00:00:00Z',
            modified: '2024-01-01T00:00:00Z',
            pattern: "[ipv4-addr:value = '10.0.0.1'] OR [ipv4-addr:value = '10.0.0.2']",
            pattern_type: 'stix',
            valid_from: '2024-01-01T00:00:00Z',
            confidence: 70,
            labels: [],
          },
        ],
      };

      const iocs = service.parseStixBundle(bundle, 'test');

      expect(iocs).toHaveLength(2);
      expect(iocs[0].value).toBe('10.0.0.1');
      expect(iocs[1].value).toBe('10.0.0.2');
    });

    it('should skip TLP:RED indicators', () => {
      const bundle: StixBundle = {
        type: 'bundle',
        id: 'bundle--test',
        objects: [
          {
            type: 'indicator',
            id: 'indicator--4',
            created: '2024-01-01T00:00:00Z',
            modified: '2024-01-01T00:00:00Z',
            pattern: "[ipv4-addr:value = '1.2.3.4']",
            pattern_type: 'stix',
            valid_from: '2024-01-01T00:00:00Z',
            confidence: 90,
            labels: ['TLP:RED'],
          },
        ],
      };

      const iocs = service.parseStixBundle(bundle, 'test');

      expect(iocs).toHaveLength(0);
    });

    it('should deduplicate IOCs within a bundle', () => {
      const bundle: StixBundle = {
        type: 'bundle',
        id: 'bundle--test',
        objects: [
          {
            type: 'indicator',
            id: 'indicator--5',
            created: '2024-01-01T00:00:00Z',
            modified: '2024-01-01T00:00:00Z',
            pattern: "[ipv4-addr:value = '1.1.1.1']",
            pattern_type: 'stix',
            valid_from: '2024-01-01T00:00:00Z',
            confidence: 80,
            labels: [],
          },
          {
            type: 'indicator',
            id: 'indicator--6',
            created: '2024-01-01T00:00:00Z',
            modified: '2024-01-01T00:00:00Z',
            pattern: "[ipv4-addr:value = '1.1.1.1']",
            pattern_type: 'stix',
            valid_from: '2024-01-01T00:00:00Z',
            confidence: 90,
            labels: [],
          },
        ],
      };

      const iocs = service.parseStixBundle(bundle, 'test');

      expect(iocs).toHaveLength(1);
    });

    it('should skip non-indicator objects', () => {
      const bundle: StixBundle = {
        type: 'bundle',
        id: 'bundle--test',
        objects: [
          {
            type: 'identity',
            id: 'identity--1',
            created: '2024-01-01T00:00:00Z',
            modified: '2024-01-01T00:00:00Z',
            name: 'Test Org',
          },
          {
            type: 'malware',
            id: 'malware--1',
            created: '2024-01-01T00:00:00Z',
            modified: '2024-01-01T00:00:00Z',
            name: 'Bad Malware',
          },
        ],
      };

      const iocs = service.parseStixBundle(bundle, 'test');

      expect(iocs).toHaveLength(0);
    });

    it('should extract MITRE techniques from kill_chain_phases', () => {
      const bundle: StixBundle = {
        type: 'bundle',
        id: 'bundle--test',
        objects: [
          {
            type: 'indicator',
            id: 'indicator--7',
            created: '2024-01-01T00:00:00Z',
            modified: '2024-01-01T00:00:00Z',
            pattern: "[ipv4-addr:value = '5.5.5.5']",
            pattern_type: 'stix',
            valid_from: '2024-01-01T00:00:00Z',
            confidence: 75,
            labels: [],
            kill_chain_phases: [
              { kill_chain_name: 'mitre-attack', phase_name: 'T1071' },
              { kill_chain_name: 'mitre-attack', phase_name: 'T1059' },
            ],
          },
        ],
      };

      const iocs = service.parseStixBundle(bundle, 'test');

      expect(iocs[0].mitreTechniques).toContain('T1071');
      expect(iocs[0].mitreTechniques).toContain('T1059');
    });
  });

  // ─────────────────────────────────────────────────────────
  // STIX Generator
  // ─────────────────────────────────────────────────────────

  describe('generateStixBundle', () => {
    it('should generate a valid STIX bundle from IOCs', () => {
      const iocs = [
        { type: 'ip' as const, value: '10.0.0.1', description: 'C2 Server', confidence: 90 },
        { type: 'domain' as const, value: 'evil.com', description: 'Phishing domain', confidence: 80 },
      ];

      const bundle = service.generateStixBundle(iocs, 'Mini-SOC');

      expect(bundle.type).toBe('bundle');
      expect(bundle.objects.length).toBeGreaterThanOrEqual(3); // identity + 2 indicators
      expect(bundle.objects[0].type).toBe('identity');

      const indicators = bundle.objects.filter((o) => o.type === 'indicator');
      expect(indicators).toHaveLength(2);
      expect(indicators[0].pattern).toContain("ipv4-addr:value = '10.0.0.1'");
      expect(indicators[1].pattern).toContain("domain-name:value = 'evil.com'");
    });

    it('should skip unsupported IOC types', () => {
      const iocs = [
        { type: 'registry_key' as const, value: 'HKLM\\Software\\Bad', confidence: 70 },
      ];

      const bundle = service.generateStixBundle(iocs, 'Mini-SOC');

      const indicators = bundle.objects.filter((o) => o.type === 'indicator');
      expect(indicators).toHaveLength(0); // registry_key not mapped to STIX pattern
    });

    it('should include hash patterns with correct syntax', () => {
      const iocs = [
        { type: 'hash_sha256' as const, value: 'abc123def456', confidence: 95 },
      ];

      const bundle = service.generateStixBundle(iocs, 'Mini-SOC');
      const indicators = bundle.objects.filter((o) => o.type === 'indicator');

      expect(indicators[0].pattern).toContain("file:hashes.'SHA-256' = 'abc123def456'");
    });
  });
});
