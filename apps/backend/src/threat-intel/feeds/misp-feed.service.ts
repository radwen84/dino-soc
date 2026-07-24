import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { CreateIocDto } from '../../ioc/dto/create-ioc.dto';
import { IOCType } from '@prisma/client';

interface MispEvent {
  id: string;
  info: string;
  threat_level_id: string;
  Attribute: MispAttribute[];
  Tag: { name: string }[];
}

interface MispAttribute {
  type: string;
  value: string;
  comment: string;
  to_ids: boolean;
}

@Injectable()
export class MispFeedService {
  private readonly logger = new Logger(MispFeedService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('MISP_URL', '');
    this.apiKey = this.configService.get<string>('MISP_API_KEY', '');
  }

  async fetchRecentEvents(hours = 24): Promise<CreateIocDto[]> {
    if (!this.baseUrl || !this.apiKey) {
      this.logger.warn('MISP not configured, skipping feed');
      return [];
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000) - hours * 3600;

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/events/restSearch`,
          { timestamp, published: true, enforceWarninglist: true },
          {
            headers: {
              Authorization: this.apiKey,
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const events: MispEvent[] = response.data.response?.map((r: any) => r.Event) || [];
      const iocs: CreateIocDto[] = [];

      for (const event of events) {
        const severity = this.mapThreatLevel(event.threat_level_id);

        for (const attr of event.Attribute || []) {
          if (!attr.to_ids) continue;

          const iocType = this.mapMispType(attr.type);
          if (!iocType) continue;

          iocs.push({
            type: iocType,
            value: attr.value,
            description: attr.comment || event.info,
            confidence: 80,
            severity,
            source: 'MISP',
            sourceReference: `${this.baseUrl}/events/view/${event.id}`,
            tags: event.Tag?.map((t) => t.name) || [],
          });
        }
      }

      this.logger.log(`MISP: fetched ${iocs.length} indicators from ${events.length} events`);
      return iocs;
    } catch (error) {
      this.logger.error(`MISP feed fetch failed: ${error.message}`);
      return [];
    }
  }

  private mapMispType(mispType: string): IOCType | null {
    const mapping: Record<string, IOCType> = {
      ip_src: 'ip',
      'ip-src': 'ip',
      ip_dst: 'ip',
      'ip-dst': 'ip',
      domain: 'domain',
      hostname: 'domain',
      url: 'url',
      md5: 'hash_md5',
      sha256: 'hash_sha256',
      sha1: 'hash_sha1',
      'email-src': 'email',
      'email-dst': 'email',
      filename: 'filename',
      'regkey': 'registry_key',
      mutex: 'mutex',
    };
    return mapping[mispType] || null;
  }

  private mapThreatLevel(level: string): 'critical' | 'high' | 'medium' | 'low' {
    switch (level) {
      case '1': return 'critical';
      case '2': return 'high';
      case '3': return 'medium';
      default: return 'low';
    }
  }
}
