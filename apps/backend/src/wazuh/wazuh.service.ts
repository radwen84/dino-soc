import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as https from 'https';

export interface WazuhResponse<T = unknown> {
  data: T;
  error: number;
  message?: string;
}

export interface WazuhAgentSummaryResponse {
  connection: {
    active: number;
    disconnected: number;
    never_connected: number;
    pending: number;
    total: number;
  };
}

export interface ActiveResponseBody {
  command: string;
  arguments: string[];
  alert: {
    data: {
      srcip?: string;
    };
  };
}

@Injectable()
export class WazuhService {
  private readonly logger = new Logger(WazuhService.name);
  private readonly baseUrl: string;
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const host = this.configService.get<string>('WAZUH_HOST', 'wazuh-manager');
    const port = this.configService.get<number>('WAZUH_API_PORT', 55000);
    this.baseUrl = `https://${host}:${port}`;
  }

  private async authenticate(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    const user = this.configService.get<string>('WAZUH_API_USER', 'wazuh-wui');
    const password = this.configService.get<string>('WAZUH_API_PASSWORD');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    try {
      const response = await firstValueFrom(
        this.httpService.post<WazuhResponse<{ token: string }>>(
          `${this.baseUrl}/security/user/authenticate`,
          null,
          {
            auth: { username: user, password: password ?? '' },
            httpsAgent: new https.Agent({
              rejectUnauthorized: nodeEnv === 'production',
            }),
          },
        ),
      );
      this.token = response.data.data.token;
      this.tokenExpiry = Date.now() + 850000; // ~14 minutes
      return this.token;
    } catch (error) {
      this.logger.error('Wazuh authentication failed', error);
      throw error;
    }
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    data?: Record<string, unknown> | ActiveResponseBody,
  ): Promise<T> {
    const token = await this.authenticate();
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    try {
      const response = await firstValueFrom(
        this.httpService.request<T>({
          method,
          url: `${this.baseUrl}${path}`,
          data,
          headers: { Authorization: `Bearer ${token}` },
          httpsAgent: new https.Agent({
            rejectUnauthorized: nodeEnv === 'production',
          }),
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Wazuh API request failed: ${method} ${path}`, error);
      throw error;
    }
  }

  async getAgents<T = unknown>(): Promise<T> {
    return this.request<T>('GET', '/agents?pretty=true&sort=-lastKeepAlive');
  }

  async getAgentById<T = unknown>(agentId: string): Promise<T> {
    return this.request<T>('GET', `/agents?agents_list=${agentId}`);
  }

  async getActiveAgentsCount(): Promise<number> {
    const result = await this.request<WazuhResponse<WazuhAgentSummaryResponse>>(
      'GET',
      '/agents/summary/status',
    );
    return result.data.connection.active;
  }

  async getAlerts<T = unknown>(limit: number = 100, offset: number = 0): Promise<T> {
    return this.request<T>('GET', `/alerts?limit=${limit}&offset=${offset}&sort=-timestamp`);
  }

  async getRules<T = unknown>(): Promise<T> {
    return this.request<T>('GET', '/rules?pretty=true&limit=500');
  }

  async getVulnerabilities<T = unknown>(agentId: string): Promise<T> {
    return this.request<T>('GET', `/vulnerability/${agentId}`);
  }

  async getSCAResults<T = unknown>(agentId: string): Promise<T> {
    return this.request<T>('GET', `/sca/${agentId}`);
  }

  async triggerActiveResponse<T = unknown>(
    agentId: string,
    command: string,
    ip?: string,
  ): Promise<T> {
    const body: ActiveResponseBody = {
      command,
      arguments: ip ? [ip] : [],
      alert: { data: { srcip: ip } },
    };
    return this.request<T>('PUT', `/active-response?agents_list=${agentId}`, body);
  }

  async blockIP<T = unknown>(agentId: string, ip: string): Promise<T> {
    this.logger.warn(`Blocking IP ${ip} on agent ${agentId}`);
    return this.triggerActiveResponse<T>(agentId, 'firewall-drop', ip);
  }

  async getClusterStatus<T = unknown>(): Promise<T> {
    return this.request<T>('GET', '/cluster/status');
  }

  async getManagerInfo<T = unknown>(): Promise<T> {
    return this.request<T>('GET', '/manager/info');
  }
}
