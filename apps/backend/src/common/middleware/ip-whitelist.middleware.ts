import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class IpWhitelistMiddleware implements NestMiddleware {
  private readonly allowedIps: string[];

  constructor(private readonly configService: ConfigService) {
    const rawList =
      this.configService.get<string>('METRICS_ALLOWED_IPS') ||
      this.configService.get<string>('ADMIN_IP_WHITELIST') ||
      '127.0.0.1,::1,::ffff:127.0.0.1';

    this.allowedIps = rawList.split(',').map((ip) => ip.trim());
  }

  use(req: Request, _res: Response, next: NextFunction) {
    if (this.allowedIps.includes('*')) {
      return next();
    }

    const forwarded = req.headers['x-forwarded-for'];
    const rawIp = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : req.ip || req.socket.remoteAddress || '';

    const normalizedIp = rawIp.replace(/^::ffff:/, '');

    const isAllowed = this.allowedIps.some(
      (ip) =>
        ip === rawIp ||
        ip === normalizedIp ||
        (ip === '::1' && (normalizedIp === '127.0.0.1' || rawIp === '::1')),
    );

    if (!isAllowed) {
      throw new ForbiddenException(`Access denied: IP ${rawIp} not whitelisted`);
    }

    next();
  }
}