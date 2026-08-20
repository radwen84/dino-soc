import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TheHiveService {
  private readonly logger = new Logger(TheHiveService.name);

  constructor(private readonly configService: ConfigService) {}

  // Exemple de méthode pour vérifier la connexion à TheHive
  async checkConnection(): Promise<boolean> {
    this.logger.log('Vérification de la connexion à TheHive...');
    return true;
  }
}