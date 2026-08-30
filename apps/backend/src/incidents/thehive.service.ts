import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
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

@Injectable()
export class TheHiveService {
  private readonly logger = new Logger(TheHiveService.name);
  private readonly theHiveUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.theHiveUrl = this.configService.get<string>('THEHIVE_URL', 'http://localhost:9000');
    this.apiKey = this.configService.get<string>('THEHIVE_API_KEY', '');
  }

  /**
   * En-têtes HTTP requis pour l'API REST de TheHive 5
   */
  private getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Pousse un incident de NestJS vers TheHive 5 sous forme d'Alerte
   * POST /api/v1/alert
   */
  async pushIncident(data: PushIncidentInput): Promise<{ _id: string }> {
    this.logger.log(`Envoi de l'incident ${data.id} vers TheHive...`);

    const payload = {
      type: data.category || 'Incident SOC',
      source: 'NestJS-SOAR',
      sourceRef: data.id,
      title: data.title,
      description: data.description || 'Aucune description fournie',
      severity: this.mapSeverityToTheHive(data.severity),
      date: data.timestamp ? new Date(data.timestamp).getTime() : Date.now(),
      tags: [
        ...(data.mitreTactics || []).map((t) => `tactic:${t}`),
        ...(data.mitreTechniques || []).map((t) => `technique:${t}`),
        `riskScore:${data.riskScore ?? 0}`,
      ],
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.theHiveUrl}/api/v1/alert`, payload, {
          headers: this.getHeaders(),
        }),
      );

      this.logger.log(`Alerte TheHive créée avec succès : ${response.data._id}`);
      return { _id: response.data._id || response.data.id };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors de l'envoi vers TheHive: ${error.response?.data?.message || error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Impossible de pousser l\'incident vers TheHive',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Déclenche un analyseur Cortex associé à TheHive sur un observable
   * POST /api/v1/connector/cortex/job
   */
  async runAnalyzers(type: string, value: string): Promise<any> {
    this.logger.log(`Lancement de l'analyseur Cortex pour [${type}] ${value}`);

    const payload = {
      cortexId: this.configService.get<string>('CORTEX_ID', 'cortex1'),
      analyzerName: this.getAnalyzerNameForType(type),
      data: value,
      dataType: this.mapDataTypeToCortex(type),
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.theHiveUrl}/api/v1/connector/cortex/job`, payload, {
          headers: this.getHeaders(),
        }),
      );

      this.logger.log(`Job Cortex démarré avec ID: ${response.data.id}`);
      return {
        status: 'success',
        jobId: response.data.id,
        type,
        value,
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur lors du lancement de l'analyseur Cortex: ${error.response?.data?.message || error.message}`,
      );
      throw new HttpException(
        'Échec du lancement de l\'analyseur Cortex',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Mappe les sévérités de votre application aux valeurs numériques de TheHive 5
   * 1: Low | 2: Medium | 3: High | 4: Critical
   */
  private mapSeverityToTheHive(severity: string): number {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 4;
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
      case 'informational':
      default:
        return 1;
    }
  }

  /**
   * Normalise le type d'observable pour Cortex
   */
  private mapDataTypeToCortex(type: string): string {
    const t = type.toLowerCase();
    if (t.includes('ip')) return 'ip';
    if (t.includes('domain')) return 'domain';
    if (t.includes('url')) return 'url';
    if (t.includes('hash') || t.includes('md5') || t.includes('sha')) return 'hash';
    if (t.includes('email')) return 'mail';
    return 'other';
  }

  /**
   * Définit un analyseur par défaut selon le type d'observable (ajustable dans le .env)
   */
  private getAnalyzerNameForType(type: string): string {
    const dataType = this.mapDataTypeToCortex(type);
    switch (dataType) {
      case 'ip':
        return 'VirusTotal_GetReport_3_0';
      case 'domain':
      case 'url':
        return 'URLScanio_Search_1_0';
      case 'hash':
        return 'VirusTotal_GetReport_3_0';
      default:
        return 'VirusTotal_GetReport_3_0';
    }
  }
}