import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

/**
 * Standard response envelope returned by the Express plugin-engine
 * (see services/plugin-engine/src/index.ts).
 */
export interface PluginExecuteResult<T = unknown> {
  success: boolean;
  /** Present when success === true */
  result?: T;
  /** Present when success === false */
  error?: string;
}

/**
 * Client service for the Express plugin-engine.
 *
 * Calls `POST http://plugin-engine:8001/plugins/:name/execute` over the
 * internal Docker network, authenticated with a shared interservice API key.
 *
 * Design goals (per SOC integration spec):
 *  - Strict timeout so a slow external plugin (e.g. VirusTotal) never blocks
 *    a NestJS request.
 *  - Graceful degradation: on any failure the method returns `null` and the
 *    caller falls back to local logic instead of throwing.
 */
@Injectable()
export class PluginEngineClient {
  private readonly logger = new Logger(PluginEngineClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    const host = this.configService.get<string>('PLUGIN_ENGINE_HOST', 'plugin-engine');
    const port = this.configService.get<number>('PLUGIN_ENGINE_PORT', 8001);
    this.baseUrl = this.configService.get<string>('PLUGIN_ENGINE_URL') || `http://${host}:${port}`;
    this.apiKey = this.configService.get<string>('INTERNAL_API_KEY', '');
    this.timeoutMs = this.configService.get<number>('PLUGIN_ENGINE_TIMEOUT_MS', 8000);
  }

  /**
   * Execute a named plugin with the given input payload.
   *
   * @returns the plugin result on success, or `null` on any failure
   *          (timeout, network error, non-2xx, plugin error) so the caller
   *          can degrade gracefully.
   */
  async execute<T = unknown>(name: string, input: Record<string, unknown> = {}): Promise<T | null> {
    // Basic client-side guard mirroring the server-side Zod validation.
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name)) {
      this.logger.warn(`Refusing to execute plugin with invalid name: "${name}"`);
      return null;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<PluginExecuteResult<T>>(
          `${this.baseUrl}/plugins/${encodeURIComponent(name)}/execute`,
          input,
          {
            timeout: this.timeoutMs, // strict per-request timeout
            headers: {
              'Content-Type': 'application/json',
              ...(this.apiKey ? { 'x-internal-api-key': this.apiKey } : {}),
            },
          },
        ),
      );

      const data = response.data;
      if (!data?.success) {
        this.logger.warn(`Plugin "${name}" returned an error: ${data?.error ?? 'unknown'}`);
        return null;
      }

      return data.result ?? null;
    } catch (error) {
      const err = error as AxiosError;
      const reason =
        err.code === 'ECONNABORTED'
          ? `timeout after ${this.timeoutMs}ms`
          : err.response
            ? `HTTP ${err.response.status}`
            : err.message;
      this.logger.warn(
        `plugin-engine call failed for "${name}" (${reason}) — degrading gracefully`,
      );
      return null;
    }
  }

  /**
   * Health check for plugin-engine connectivity.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/health`, { timeout: 2000 }),
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
