import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';

@Injectable()
export class OpenSearchService implements OnModuleInit {
  private readonly logger = new Logger(OpenSearchService.name);
  private client: Client;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('OPENSEARCH_HOST', 'opensearch');
    const port = this.configService.get<number>('OPENSEARCH_PORT', 9200);
    const node = this.configService.get<string>('OPENSEARCH_URL') ||
      this.configService.get<string>('OPENSEARCH_NODE') || `http://${host}:${port}`;
    const password = this.configService.get<string>('OPENSEARCH_ADMIN_PASSWORD');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    this.client = new Client({
      node,
      ...(password ? { auth: { username: 'admin', password } } : {}),
      ssl: {
        rejectUnauthorized: nodeEnv === 'production',
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      const health = await this.client.cluster.health();
      this.logger.log(`OpenSearch cluster status: ${health.body.status}`);
    } catch (error) {
      this.logger.warn('OpenSearch not available - features degraded', error);
    }
  }

  async search(index: string, body: any): Promise<any> {
    try {
      const response = await this.client.search({ index, body });
      return response.body;
    } catch (error) {
      this.logger.error(`Search failed on index ${index}`, error);
      throw error;
    }
  }

  async index(indexName: string, document: any, id?: string): Promise<any> {
    const params: any = { index: indexName, body: document };
    if (id) params.id = id;
    return this.client.index(params);
  }

  async aggregate(index: string, aggs: any, query?: any): Promise<any> {
    const body: any = { size: 0, aggs };
    if (query) body.query = query;

    const response = await this.client.search({ index, body });
    return response.body.aggregations;
  }

  async count(index: string, query?: any): Promise<number> {
    const body: any = query ? { query } : {};
    const response = await this.client.count({ index, body });
    return response.body.count;
  }

  async getAlertsByTimeRange(startDate: Date, endDate: Date, level?: number) {
    const query: any = {
      bool: {
        must: [
          { range: { '@timestamp': { gte: startDate.toISOString(), lte: endDate.toISOString() } } },
        ],
      },
    };

    if (level) {
      query.bool.must.push({ range: { 'rule.level': { gte: level } } });
    }

    return this.search('wazuh-alerts-*', {
      query,
      sort: [{ '@timestamp': { order: 'desc' } }],
      size: 1000,
    });
  }

  async getMitreStats(days: number = 30) {
    const since = new Date(Date.now() - days * 86400000);
    return this.aggregate(
      'wazuh-alerts-*',
      {
        mitre_techniques: {
          terms: { field: 'rule.mitre.id', size: 50 },
        },
        mitre_tactics: {
          terms: { field: 'rule.mitre.tactic', size: 20 },
        },
      },
      {
        range: { '@timestamp': { gte: since.toISOString() } },
      },
    );
  }

  async getTopSourceIPs(limit: number = 20, hours: number = 24) {
    const since = new Date(Date.now() - hours * 3600000);
    return this.aggregate(
      'wazuh-alerts-*',
      {
        top_ips: {
          terms: { field: 'data.srcip', size: limit },
        },
      },
      {
        range: { '@timestamp': { gte: since.toISOString() } },
      },
    );
  }
}
