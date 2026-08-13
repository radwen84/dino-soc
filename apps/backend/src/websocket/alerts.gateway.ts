import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { AlertsService } from '../alerts/alerts.service';
import { IncidentsService } from '../incidents/incidents.service';

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: process.env.API_CORS_ORIGINS?.split(',') ||
      process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class AlertsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(AlertsGateway.name);
  private connectedClients: number = 0;

  constructor(
    private readonly alertsService: AlertsService,
    private readonly incidentsService: IncidentsService,
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(client: Socket): void {
    try {
      const token = client.handshake.auth?.token;
      if (!token) throw new Error('Missing token');
      this.jwtService.verify(token, { issuer: 'minisoc', audience: 'minisoc-api' });
    } catch {
      client.emit('connect_error', { message: 'Authentication required' });
      client.disconnect(true);
      return;
    }
    client.data.authenticated = true;
    this.connectedClients++;
    this.logger.log(`Client connected: ${client.id} (total: ${this.connectedClients})`);
  }

  handleDisconnect(client: Socket): void {
    if (!client.data.authenticated) return;
    this.connectedClients = Math.max(0, this.connectedClients - 1);
    this.logger.log(`Client disconnected: ${client.id} (total: ${this.connectedClients})`);
  }

  // Listen for new alerts from event emitter
  @OnEvent('alert.new')
  handleNewAlert(alert: any): void {
    this.server.emit('alert:new', {
      id: alert.id,
      level: alert.level,
      ruleDescription: alert.ruleDescription,
      srcIp: alert.srcIp,
      agentName: alert.agentName,
      mitreTechnique: alert.mitreTechnique,
      timestamp: alert.timestamp,
    });
  }

  // Listen for incident changes
  @OnEvent('incident.created')
  handleIncidentCreated(incident: any): void {
    this.server.emit('incident:created', {
      id: incident.id,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
    });
  }

  @OnEvent('incident.status_changed')
  handleIncidentStatusChanged(data: any): void {
    this.server.emit('incident:updated', {
      id: data.incident.id,
      previousStatus: data.previousStatus,
      newStatus: data.newStatus,
    });
  }

  // Push stats every 10 seconds
  @Interval(10000)
  async broadcastStats(): Promise<void> {
    if (this.connectedClients === 0) return;

    try {
      const alertCount = await this.alertsService.countByTimeRange(1);
      const stats = await this.incidentsService.getStatistics();

    this.server.emit('stats:update', {
        alertsLastHour: alertCount,
        openIncidents: stats.overview.openIncidents,
        criticalIncidents: stats.overview.criticalIncidents,
        connectedClients: this.connectedClients,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to broadcast stats', error);
    }
  }

  // Manual broadcast method for other services
  broadcastAlert(alert: any): void {
    this.server.emit('alert:new', alert);
  }
}
