import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get(['', '/api/health'])
  @ApiOperation({ summary: 'Health check endpoint' })
  async check(@Res() res: Response) {
    const checks: Record<string, string> = {};

    // Database check
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'healthy';
    } catch {
      checks.database = 'unhealthy';
    }

    // Redis check
    try {
      await this.redis.getClient().ping();
      checks.redis = 'healthy';
    } catch {
      checks.redis = 'unhealthy';
    }

    const isHealthy = Object.values(checks).every((v) => v === 'healthy');
    const statusCode = isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json({
      status: isHealthy ? 'healthy' : 'degraded',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks,
    });
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check (for Kubernetes)' })
  async ready(@Res() res: Response) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return res.status(HttpStatus.OK).json({ status: 'ready' });
    } catch {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ status: 'not_ready' });
    }
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check (for Kubernetes)' })
  live() {
    return { status: 'alive', uptime: process.uptime() };
  }
}