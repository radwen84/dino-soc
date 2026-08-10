import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { IpWhitelistMiddleware } from '../common/middleware/ip-whitelist.middleware';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * Prometheus metrics endpoint.
   * Accessible without auth (for Prometheus scraping) but protected via:
   * - Network policies in Kubernetes
   * - IP whitelist via METRICS_ALLOWED_IPS env var
   * - Nginx reverse proxy (production)
   */
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
