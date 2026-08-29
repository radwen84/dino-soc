import { Injectable, Logger } from '@nestjs/common';
import { OpenSearchService } from '../opensearch/opensearch.service';

@Injectable()
export class IocService {
  private readonly logger = new Logger(IocService.name);

  constructor(private readonly opensearch: OpenSearchService) {}

  async indexIocInOpenSearch(ioc: any): Promise<void> {
    try {
      // Normalisation stricte pour éviter mapper_parsing_exception dans OpenSearch
      const document = {
        id: String(ioc.id),
        type: String(ioc.type),
        value: String(ioc.value),
        description: ioc.description ? String(ioc.description) : '',
        status: String(ioc.status || 'active'),
        confidence: Number(ioc.confidence || 50),
        severity: String(ioc.severity || 'medium'),
        source: String(ioc.source || 'manual'),
        sourceReference: ioc.sourceReference ? String(ioc.sourceReference) : null,
        mitreTechniques: Array.isArray(ioc.mitreTechniques) ? ioc.mitreTechniques : [],
        tags: Array.isArray(ioc.tags) ? ioc.tags : [],
        createdAt: new Date(ioc.createdAt || Date.now()).toISOString(),
        expiresAt: ioc.expiresAt ? new Date(ioc.expiresAt).toISOString() : null,
      };

      await this.opensearch.index('minisoc-iocs', ioc.id, document);
      this.logger.log(`IOC indexed successfully in OpenSearch: ${ioc.value}`);
    } catch (error) {
      this.logger.warn(
        `Failed to index IOC in OpenSearch: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}