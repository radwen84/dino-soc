import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { OpenSearchModule } from '../opensearch/opensearch.module';

@Module({
  imports: [OpenSearchModule, HttpModule],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
