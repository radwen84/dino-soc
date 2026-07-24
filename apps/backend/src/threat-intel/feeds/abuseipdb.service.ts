import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface AbuseIpDbReport {
  ipAddress: string;
  isPublic: boolean;
  abuseConfidenceScore: number;
  countryCode: string;
  isp: string;
  domain: string;
  totalReports: number;
  lastReportedAt: string;
  categories: number[];
}

@Injectable()
export class AbuseIpDbService {
  private readonly logger = new Logger(AbuseIpDbService.name);
  private readonly baseUrl = 'https://api.abuseipdb.com/api/v2';
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('ABUSEIPDB_API_KEY', '');
  }

  /**
   * Check IP reputation against AbuseIPDB
   */
  async checkIp(ip: string): Promise<AbuseIpDbReport | null> {
    if (!this.apiKey) {
      this.logger.warn('AbuseIPDB API key not configured');
      return null;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/check`, {
          headers: {
            Key: this.apiKey,
            Accept: 'application/json',
          },
          params: { ipAddress: ip, maxAgeInDays: 90 },
        }),
      );

      return response.data.data as AbuseIpDbReport;
    } catch (error) {
      this.logger.error(`AbuseIPDB check failed for ${ip}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get blacklisted IPs (top reported)
   */
  async getBlacklist(limit = 100): Promise<string[]> {
    if (!this.apiKey) return [];

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/blacklist`, {
          headers: { Key: this.apiKey, Accept: 'application/json' },
          params: { confidenceMinimum: 90, limit },
        }),
      );

      return response.data.data.map((entry: any) => entry.ipAddress);
    } catch (error) {
      this.logger.error(`AbuseIPDB blacklist fetch failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Map AbuseIPDB categories to severity
   */
  mapCategoriesToSeverity(categories: number[]): string {
    // High-risk categories: SSH brute-force, DDoS, exploits
    const highRisk = [14, 15, 16, 17, 22, 23];
    // Critical categories: Ransomware, C2
    const critical = [20, 21];

    if (categories.some((c) => critical.includes(c))) return 'critical';
    if (categories.some((c) => highRisk.includes(c))) return 'high';
    return 'medium';
  }
}
