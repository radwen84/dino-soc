import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class IpWhitelistMiddleware implements NestMiddleware {
  private readonly allowedIps: string[];

  constructor(private readonly configService: ConfigService) {
    this.allowedIps = (this.configService.get<string>('ADMIN_IP_WHITELIST') || '127.0.0.1,::1')
      .split(',')
      .map((ip) => ip.trim());
  }

  use(req: Request, _res: Response, next: NextFunction) {
    const clientIp = req.ip || req.socket.remoteAddress || '';

    if (!this.allowedIps.includes(clientIp) && !this.allowedIps.includes('*')) {
      throw new ForbiddenException('Access denied: IP not whitelisted');
    }

    next();
  }
}
