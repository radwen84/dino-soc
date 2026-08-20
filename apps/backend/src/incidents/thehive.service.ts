import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  constructor(private readonly configService: ConfigService) {}

  /**
   * Pousse un incident de NestJS vers TheHive 5 sous forme d'alerte / cas
   */
  async pushIncident(data: PushIncidentInput): Promise<{ _id: string }> {
    this.logger.log(`Envoi de l'incident ${data.id} vers TheHive...`);

    // TODO: Implémenter l'appel HTTP (via Axios / HttpService) vers l'API REST de TheHive 5
    
    return {
      _id: `th-alert-${data.id}`,
    };
  }

  /**
   * Déclenche un analyseur Cortex sur un observable (IP, Hash, URL, etc.)
   */
  async runAnalyzers(type: string, value: string): Promise<any> {
    this.logger.log(`Lancement de l'analyseur Cortex pour [${type}] ${value}`);

    // TODO: Implémenter l'appel HTTP vers Cortex ou l'API de TheHive pour l'observable
    
    return {
      status: 'success',
      type,
      value,
    };
  }
}