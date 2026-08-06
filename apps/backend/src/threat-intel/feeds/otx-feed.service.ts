import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { CreateIocDto } from '../../ioc/dto/create-ioc.dto';
import { IOCType } from '@prisma/client';

interface OtxPulse {
  id: string;
  name: string;
  description: string;
  indicators: OtxIndicator[];
  created: string;
  tags: string[];
  references: string[];
  attack_ids: { id: string; name: string }[];
}

interface OtxIndicator {
  type: string;
  indicator: string;
  description: string;
}

interface OtxPulsesResponse {
  results?: OtxPulse[];
}

const OTX_IOC_TYPE_MAPPING = {
  IPv4: 'ip',
  IPv6: 'ip',
  domain: 'domain',
  hostname: 'domain',
  URL: 'url',
  FileHash_MD5: 'hash_md5',
  'FileHash-MD5': 'hash_md5',
  FileHash_SHA256: 'hash_sha256',
  'FileHash-SHA256': 'hash_sha256',
  FileHash_SHA1: 'hash_sha1',
  'FileHash-SHA1': 'hash_sha1',
  email: 'email',
  FilePath: 'filename',
  CIDR: 'cidr',
} as const satisfies Record<string, IOCType>;

type OtxIocType = (typeof OTX_IOC_TYPE_MAPPING)[keyof typeof OTX_IOC_TYPE_MAPPING];

@Injectable()
export class OtxFeedService {
  private readonly logger = new Logger(OtxFeedService.name);
  private readonly baseUrl = 'https://otx.alienvault.com/api/v1';
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('OTX_API_KEY', '');
  }

  async fetchLatestPulses(limit = 50): Promise<CreateIocDto[]> {
    if (!this.apiKey) {
      this.logger.warn('OTX API key not configured, skipping feed');
      return [];
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get<OtxPulsesResponse>(`${this.baseUrl}/pulses/subscribed`, {
          headers: { 'X-OTX-API-KEY': this.apiKey },
          params: { limit, modified_since: this.getLastSyncDate() },
        }),
      );

      const pulses: OtxPulse[] = response.data.results || [];
      const iocs: CreateIocDto[] = [];

      for (const pulse of pulses) {
        for (const indicator of pulse.indicators) {
          const iocType = this.mapOtxType(indicator.type);
          if (!iocType) continue;

          iocs.push({
            type: iocType,
            value: indicator.indicator,
            description: indicator.description || pulse.name,
            confidence: 70,
            severity: 'medium',
            source: 'AlienVault OTX',
            sourceReference: `https://otx.alienvault.com/pulse/${pulse.id}`,
            mitreTechniques: pulse.attack_ids?.map((a) => a.id) || [],
            tags: pulse.tags || [],
          });
        }
      }

      this.logger.log(`OTX: fetched ${iocs.length} indicators from ${pulses.length} pulses`);
      return iocs;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`OTX feed fetch failed: ${message}`);
      return [];
    }
  }

  private mapOtxType(otxType: string): OtxIocType | null {
    return OTX_IOC_TYPE_MAPPING[otxType as keyof typeof OTX_IOC_TYPE_MAPPING] ?? null;
  }

  private getLastSyncDate(): string {
    const date = new Date();
    date.setHours(date.getHours() - 24);
    return date.toISOString();
  }
}
