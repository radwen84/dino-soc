import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface PushIncidentInput {
  id: string;
  title: string;
  description: string;
  severity: string;
  category?: string;
  mitreTactics?: string[];
  mitreTechniques?: string[];
  riskScore?: number;
  timestamp?: Date;
}

export interface TheHivePushResult {
  _id: string;
  status: 'sent';
  url: string;
}

export interface AnalyzerRunResult {
  status: 'success' | 'skipped';
  type: string;
  value: string;
  analyzerId?: string;
  jobId?: string;
  reason?: string;
}

@Injectable()
export class TheHiveService {
  private readonly logger = new Logger(TheHiveService.name);
  private readonly requestTimeoutMs = 10_000;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Pousse un incident de NestJS vers TheHive 5 sous forme d'alerte / cas
   */
  async pushIncident(data: PushIncidentInput): Promise<TheHivePushResult | null> {
    this.logger.log(`Envoi de l'incident ${data.id} vers TheHive...`);

    const baseUrl = this.configService.get<string>('THEHIVE_URL', '').replace(/\/$/, '');
    const apiKey = this.configService.get<string>('THEHIVE_API_KEY', '');
    const organization = this.configService.get<string>('THEHIVE_ORGANIZATION', 'Mini-SOC');

    if (!baseUrl || !apiKey) {
      this.logger.warn('TheHive integration skipped: THEHIVE_URL or THEHIVE_API_KEY is missing');
      return null;
    }

    const url = `${baseUrl}/api/v1/alert`;
    const payload = {
      type: 'minisoc-incident',
      source: 'minisoc-api',
      sourceRef: data.id,
      title: data.title,
      description: data.description,
      severity: this.mapSeverity(data.severity),
      tlp: 2,
      pap: 2,
      tags: [
        'minisoc',
        ...(data.category ? [data.category] : []),
        ...(data.mitreTactics || []),
        ...(data.mitreTechniques || []),
      ],
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'X-Auth-Token': apiKey,
            'X-Organization': organization,
            Accept: 'application/json',
          },
          timeout: this.requestTimeoutMs,
        }),
      );
      const id = response.data?._id || response.data?.id;
      if (!id) throw new Error('TheHive response did not contain an alert id');
      return { _id: id, status: 'sent', url };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`TheHive incident push failed for ${data.id}: ${message}`);
      return null;
    }
  }

  /**
   * Déclenche un analyseur Cortex sur un observable (IP, Hash, URL, etc.)
   */
  async runAnalyzers(type: string, value: string): Promise<AnalyzerRunResult> {
    this.logger.log(`Lancement de l'analyseur Cortex pour [${type}] ${value}`);

    const baseUrl = this.configService.get<string>('CORTEX_URL', '').replace(/\/$/, '');
    const apiKey = this.configService.get<string>('CORTEX_API_KEY', '');
    if (!baseUrl || !apiKey) {
      this.logger.warn('Cortex integration skipped: CORTEX_URL or CORTEX_API_KEY is missing');
      return { status: 'skipped', type, value, reason: 'Cortex is not configured' };
    }

    try {
      const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
      const analyzersResponse = await firstValueFrom(
        this.httpService.get(`${baseUrl}/api/analyzer`, {
          headers,
          timeout: this.requestTimeoutMs,
        }),
      );
      const analyzers = Array.isArray(analyzersResponse.data) ? analyzersResponse.data : [];
      const analyzer = analyzers.find((item: any) =>
        Array.isArray(item.dataTypeList) && item.dataTypeList.includes(type),
      );
      if (!analyzer?.id) {
        return { status: 'skipped', type, value, reason: `No Cortex analyzer supports ${type}` };
      }

      const response = await firstValueFrom(
        this.httpService.post(
          `${baseUrl}/api/analyzer/${analyzer.id}/run`,
          { data: value, dataType: type, tlp: 2, message: 'Mini-SOC incident enrichment' },
          { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: this.requestTimeoutMs },
        ),
      );
      return {
        status: 'success',
        type,
        value,
        analyzerId: analyzer.id,
        jobId: response.data?.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Cortex analyzer failed for ${type}:${value}: ${message}`);
      return { status: 'skipped', type, value, reason: message };
    }
  }

  private mapSeverity(severity: string): number {
    return { critical: 4, high: 3, medium: 2, low: 1, informational: 1 }[severity] || 2;
  }
}