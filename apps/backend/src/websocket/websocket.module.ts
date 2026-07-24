import { Module } from '@nestjs/common';
import { AlertsGateway } from './alerts.gateway';
import { AlertsModule } from '../alerts/alerts.module';
import { IncidentsModule } from '../incidents/incidents.module';

@Module({
  imports: [AlertsModule, IncidentsModule],
  providers: [AlertsGateway],
  exports: [AlertsGateway],
})
export class WebsocketModule {}
