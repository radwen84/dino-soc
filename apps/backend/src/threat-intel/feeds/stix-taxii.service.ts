import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { CreateIocDto } from '../../ioc/dto/create-ioc.dto';
import { IOCType } from '@prisma/client';

// Interfaces... (inchangées)
export interface StixBundle {
  type: 'bundle';
  id: string;
  objects: StixObject[];
}

export interface StixObject {
  type: string;
  id: string;
  created: string;
  modified: string;
  name?: string;
  description?: string;
  labels?: string[];
  confidence?: number;
  pattern?: string;
  pattern_type?: string;
  valid_from?: string;
  valid_until?: string;
  kill_chain_phases?: { kill_chain_name: string; phase_name: string }[];
  external_references?: { source_name: string; url?: string; external_id?: string }[];
  indicator_types?: string[];
  value?: string;
}

export interface TaxiiCollection {
  id: string;
  title: string;
  description?: string;
  can_read: boolean;
  can_write: boolean;
  media_types?: string[];
}

export interface TaxiiApiRoot {
  title: string;
  description?: string;
  versions: string[];
  max_content_length: number;
}

export enum TlpLevel {
  CLEAR = 'TLP:CLEAR',
  GREEN = 'TLP:GREEN',
  AMBER = 'TLP:AMBER',
  AMBER_STRICT = 'TLP:AMBER+STRICT',
  RED = 'TLP:RED',
}

@Injectable()
export class StixTaxiiService {
  private readonly logger = new Logger(StixTaxiiService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Nettoie et formate les URLs pour éviter les doubles slashes ou les valeurs 'undefined'
   */
  private buildUrl(baseUrl: string, ...paths: string[]): string {
    const cleanBase = (baseUrl || '').replace(/\/+$/, '');
    const cleanPaths = paths
      .filter(Boolean)
      .map((p) => p.replace(/^\/+|\/+$/g, ''))
      .join('/');
    return cleanPaths ? `${cleanBase}/${cleanPaths}` : cleanBase;
  }

  async discoverApiRoot(
    serverUrl: string,
    credentials?: { user: string; password: string },
  ): Promise<TaxiiApiRoot | null> {
    try {
      const url = this.buildUrl(serverUrl, 'taxii2');
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: this.getTaxiiHeaders(),
          auth: credentials
            ? { username: credentials.user, password: credentials.password }
            : undefined,
        }),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`TAXII discovery failed for ${serverUrl}: ${error.message}`);
      return null;
    }
  }

  async listCollections(
    serverUrl: string,
    apiRoot: string = 'taxii2',
    credentials?: { user: string; password: string },
  ): Promise<TaxiiCollection[]> {
    try {
      const url = this.buildUrl(serverUrl, apiRoot, 'collections');
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: this.getTaxiiHeaders(),
          auth: credentials
            ? { username: credentials.user, password: credentials.password }
            : undefined,
        }),
      );
      return response.data.collections || [];
    } catch (error: any) {
      this.logger.error(`TAXII list collections failed: ${error.message}`);
      return [];
    }
  }

  async pollCollection(
    serverUrl: string,
    apiRoot: string = 'taxii2',
    collectionId: string,
    options?: {
      addedAfter?: string;
      limit?: number;
      type?: string[];
      credentials?: { user: string; password: string };
    },
  ): Promise<StixBundle | null> {
    try {
      const url = this.buildUrl(serverUrl, apiRoot, 'collections', collectionId, 'objects');
      const params: Record<string, any> = {};
      if (options?.addedAfter) params.added_after = options.addedAfter;
      if (options?.limit) params.limit = options.limit;
      if (options?.type?.length) params.type = options.type.join(',');

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: this.getTaxiiHeaders(),
          params,
          auth: options?.credentials
            ? { username: options.credentials.user, password: options.credentials.password }
            : undefined,
        }),
      );

      return response.data as StixBundle;
    } catch (error: any) {
      this.logger.error(`TAXII poll failed for collection ${collectionId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Ingestion complète depuis un flux TAXII
   */
  async ingestFromTaxiiFeed(feedConfig: {
    serverUrl: string;
    apiRoot?: string;
    collectionId: string;
    credentials?: { user: string; password: string };
    addedAfter?: string;
  }): Promise<CreateIocDto[]> {
    const serverUrl = feedConfig.serverUrl || 'https://cti-taxii.mitre.org';
    const apiRoot = feedConfig.apiRoot || 'taxii2';
    const collectionId = feedConfig.collectionId || '';

    // 💡 FIX LOG: Construction de l'URL sécurisée sans 'undefined'
    const fullLogUrl = this.buildUrl(serverUrl, apiRoot, collectionId);
    this.logger.log(`Ingesting from TAXII: ${fullLogUrl}`);

    const bundle = await this.pollCollection(serverUrl, apiRoot, collectionId, {
      addedAfter: feedConfig.addedAfter,
      type: ['indicator'],
      credentials: feedConfig.credentials,
    });

    if (!bundle || !bundle.objects?.length) {
      this.logger.log('TAXII: No new indicators found');
      return [];
    }

    const source = `TAXII:${serverUrl}/${collectionId}`;
    const iocs = this.parseStixBundle(bundle, source);

    this.logger.log(`TAXII: Parsed ${iocs.length} IOCs from ${bundle.objects.length} STIX objects`);
    return iocs;
  }

  parseStixBundle(bundle: StixBundle, source: string): CreateIocDto[] {
    const iocs: CreateIocDto[] = [];

    for (const object of bundle.objects) {
      if (object.type === 'indicator') {
        const parsed = this.parseStixIndicator(object, source);
        if (parsed.length > 0) iocs.push(...parsed);
      }
    }

    return this.deduplicateIocs(iocs);
  }

  private parseStixIndicator(indicator: StixObject, source: string): CreateIocDto[] {
    if (!indicator.pattern || indicator.pattern_type !== 'stix') return [];

    const iocs: CreateIocDto[] = [];
    const tlp = this.extractTlp(indicator.labels || []);
    const confidence = indicator.confidence || 60;
    const mitreTechniques = this.extractMitreTechniques(indicator);

    const patterns = this.extractPatternsFromStix(indicator.pattern);

    for (const { type, value } of patterns) {
      const iocType = this.mapStixTypeToIoc(type);
      if (!iocType) continue;

      if (tlp === TlpLevel.RED) {
        this.logger.debug(`Skipping TLP:RED indicator: ${value}`);
        continue;
      }

      iocs.push({
        type: iocType,
        value,
        description: indicator.description || indicator.name || `STIX indicator from ${source}`,
        confidence: Math.min(confidence, 100),
        severity: this.confidenceToSeverity(confidence),
        source,
        sourceReference: indicator.id,
        mitreTechniques,
        tags: [...(indicator.labels || []), tlp].filter(Boolean),
        expiresAt: indicator.valid_until || undefined,
      });
    }

    return iocs;
  }

  /**
   * Supporte la syntaxe standard et les hachages complexes de STIX 2.1
   */
  private extractPatternsFromStix(pattern: string): Array<{ type: string; value: string }> {
    const results: Array<{ type: string; value: string }> = [];

    // Expression régulière adaptée aux motifs STIX simples et complexes (file:hashes...)
    const regex = /\[([a-z0-9-]+):([a-z0-9._':-]+)\s*=\s*'([^']+)'\]/gi;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(pattern)) !== null) {
      const objectType = match[1];
      const propertyPath = match[2];
      const value = match[3];

      // Gestion spécifique des hashes de fichier
      if (objectType === 'file' && propertyPath.includes('hashes')) {
        if (propertyPath.includes('SHA-256')) {
          results.push({ type: 'file_sha256', value });
        } else if (propertyPath.includes('MD5')) {
          results.push({ type: 'file_md5', value });
        } else if (propertyPath.includes('SHA-1')) {
          results.push({ type: 'file_sha1', value });
        }
      } else {
        results.push({ type: objectType, value });
      }
    }

    return results;
  }

  private mapStixTypeToIoc(stixType: string): IOCType | null {
    const mapping: Record<string, IOCType> = {
      'ipv4-addr': 'ip',
      'ipv6-addr': 'ip',
      'domain-name': 'domain',
      url: 'url',
      file: 'hash_sha256',
      file_sha256: 'hash_sha256',
      file_md5: 'hash_md5',
      file_sha1: 'hash_sha1',
      'email-addr': 'email',
      'network-traffic': 'ip',
      'user-agent': 'user_agent',
    };
    return mapping[stixType] || null;
  }

  generateStixBundle(
    iocs: Array<{
      type: IOCType;
      value: string;
      description?: string;
      confidence?: number;
      severity?: string;
      mitreTechniques?: string[];
    }>,
    identity: string,
  ): StixBundle {
    const objects: StixObject[] = [];
    const now = new Date().toISOString();

    objects.push({
      type: 'identity',
      id: `identity--${this.generateUUID5(identity)}`,
      created: now,
      modified: now,
      name: identity,
      description: 'Mini-SOC Platform',
    });

    for (const ioc of iocs) {
      const pattern = this.iocToStixPattern(ioc.type, ioc.value);
      if (!pattern) continue;

      objects.push({
        type: 'indicator',
        id: `indicator--${crypto.randomUUID()}`,
        created: now,
        modified: now,
        name: `${ioc.type}: ${ioc.value}`,
        description: ioc.description || `IOC detected by Mini-SOC`,
        pattern,
        pattern_type: 'stix',
        valid_from: now,
        confidence: ioc.confidence || 70,
        labels: ['malicious-activity'],
        indicator_types: ['malicious-activity'],
        kill_chain_phases: ioc.mitreTechniques?.map((t) => ({
          kill_chain_name: 'mitre-attack',
          phase_name: t,
        })),
      });
    }

    return {
      type: 'bundle',
      id: `bundle--${crypto.randomUUID()}`,
      objects,
    };
  }

  private iocToStixPattern(type: IOCType, value: string): string | null {
    switch (type) {
      case 'ip':
        return `[ipv4-addr:value = '${value}']`;
      case 'domain':
        return `[domain-name:value = '${value}']`;
      case 'url':
        return `[url:value = '${value}']`;
      case 'hash_md5':
        return `[file:hashes.'MD5' = '${value}']`;
      case 'hash_sha256':
        return `[file:hashes.'SHA-256' = '${value}']`;
      case 'hash_sha1':
        return `[file:hashes.'SHA-1' = '${value}']`;
      case 'email':
        return `[email-addr:value = '${value}']`;
      case 'filename':
        return `[file:name = '${value}']`;
      default:
        return null;
    }
  }

  private getTaxiiHeaders(): Record<string, string> {
    return {
      Accept: 'application/taxii+json;version=2.1',
      'Content-Type': 'application/taxii+json;version=2.1',
    };
  }

  private extractTlp(labels: string[]): TlpLevel | string {
    const tlpLabel = labels.find((l) => l.toUpperCase().startsWith('TLP:'));
    if (!tlpLabel) return TlpLevel.CLEAR;
    return tlpLabel.toUpperCase() as TlpLevel;
  }

  private extractMitreTechniques(indicator: StixObject): string[] {
    const techniques: string[] = [];

    if (indicator.kill_chain_phases) {
      for (const phase of indicator.kill_chain_phases) {
        if (phase.kill_chain_name === 'mitre-attack') {
          techniques.push(phase.phase_name);
        }
      }
    }

    if (indicator.external_references) {
      for (const ref of indicator.external_references) {
        if (ref.source_name === 'mitre-attack' && ref.external_id) {
          techniques.push(ref.external_id);
        }
      }
    }

    return techniques;
  }

  private confidenceToSeverity(confidence: number): 'critical' | 'high' | 'medium' | 'low' {
    if (confidence >= 90) return 'critical';
    if (confidence >= 70) return 'high';
    if (confidence >= 50) return 'medium';
    return 'low';
  }

  private deduplicateIocs(iocs: CreateIocDto[]): CreateIocDto[] {
    const seen = new Set<string>();
    return iocs.filter((ioc) => {
      const key = `${ioc.type}:${ioc.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private generateUUID5(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(12, '0');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5000-8000-${hex.padEnd(12, '0')}`;
  }
}