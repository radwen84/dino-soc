import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RiskScoreResult {
  risk_score: number;
  confidence: number;
  anomaly_detected: boolean;
  factors: string[];
}

/**
 * Client service for the Python ml-engine (FastAPI).
 * Calls /risk-score to get ML-based risk assessment for incidents.
 */
@Injectable()
export class MlEngineService {
  private readonly logger = new Logger(MlEngineService.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('ML_ENGINE_HOST', 'ml-engine');
    const port = this.configService.get<number>('ML_ENGINE_PORT', 8000);
    this.baseUrl = this.configService.get<string>('ML_ENGINE_URL') || `http://${host}:${port}`;
  }

  /**
   * Get risk score from ml-engine for a given incident context.
   * Falls back gracefully if ml-engine is unavailable.
   */
  async getRiskScore(context: {
    severity: string;
    category?: string;
    mitreTechniques?: string[];
    srcIps?: string[];
    affectedAssets?: string[];
    alertCount?: number;
    confidence?: number;
    threatIntelScore?: number;
  }): Promise<RiskScoreResult | null> {
    try {
      const response = await fetch(`${this.baseUrl}/risk-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          severity: context.severity,
          confidence: context.confidence ?? 80,
          ioc_matches: context.srcIps?.length || 0,
          affected_assets: context.affectedAssets?.length || 1,
          asset_criticality: 'medium',
          mitre_techniques: context.mitreTechniques?.length || 0,
          ueba_score: 0,
          threat_intel_score: context.threatIntelScore ?? 0,
        }),
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      if (!response.ok) {
        this.logger.warn(`ml-engine /risk-score returned ${response.status}`);
        return null;
      }

      const result = (await response.json()) as RiskScoreResult;
      this.logger.debug(`ML risk score: ${result.risk_score} (confidence: ${result.confidence})`);
      return result;
    } catch (error) {
      this.logger.warn(
        `ml-engine unavailable (${error.message}) — falling back to rule-based scoring`,
      );
      return null;
    }
  }

  /**
   * Health check for ml-engine connectivity
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
