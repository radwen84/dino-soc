import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

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

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/security/user/authenticate`, null, {
          auth: { username: user, password: password },
          httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
        }),
      );
      this.token = response.data.data.token;
      this.tokenExpiry = Date.now() + 850000; // ~14 minutes
      return this.token;
    } catch (error) {
      this.logger.error('Wazuh authentication failed', error);
      throw error;
    }
  }

  private async request(method: string, path: string, data?: any): Promise<any> {
    const token = await this.authenticate();
    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method,
          url: `${this.baseUrl}${path}`,
          data,
          headers: { Authorization: `Bearer ${token}` },
          httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Wazuh API request failed: ${method} ${path}`, error);
      throw error;
    }
  }

  async getAgents(): Promise<any> {
    return this.request('GET', '/agents?pretty=true&sort=-lastKeepAlive');
  }

  async getAgentById(agentId: string): Promise<any> {
    return this.request('GET', `/agents?agents_list=${agentId}`);
  }

  async getActiveAgentsCount(): Promise<number> {
    const result = await this.request('GET', '/agents/summary/status');
    return result.data.connection.active;
  }

  async getAlerts(limit: number = 100, offset: number = 0): Promise<any> {
    return this.request('GET', `/alerts?limit=${limit}&offset=${offset}&sort=-timestamp`);
  }

  async getRules(): Promise<any> {
    return this.request('GET', '/rules?pretty=true&limit=500');
  }

  async getVulnerabilities(agentId: string): Promise<any> {
    return this.request('GET', `/vulnerability/${agentId}`);
  }

  async getSCAResults(agentId: string): Promise<any> {
    return this.request('GET', `/sca/${agentId}`);
  }

  async triggerActiveResponse(agentId: string, command: string, ip?: string): Promise<any> {
    const body: any = {
      command,
      arguments: ip ? [ip] : [],
      alert: { data: { srcip: ip } },
    };
    return this.request('PUT', `/active-response?agents_list=${agentId}`, body);
  }

  async blockIP(agentId: string, ip: string): Promise<any> {
    this.logger.warn(`Blocking IP ${ip} on agent ${agentId}`);
    return this.triggerActiveResponse(agentId, 'firewall-drop', ip);
  }

  async getClusterStatus(): Promise<any> {
    return this.request('GET', '/cluster/status');
  }

  async getManagerInfo(): Promise<any> {
    return this.request('GET', '/manager/info');
  }
}
