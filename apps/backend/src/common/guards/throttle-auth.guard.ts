import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class AuthThrottleGuard extends ThrottlerGuard {
  protected override async getTracker(req: Request): Promise<string> {
    // Track by IP + email for auth endpoints
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';

    // Extrait et valide explicitement que 'email' est une chaîne de caractères
    const body = req.body as Record<string, unknown> | undefined;
    const email: string = typeof body?.email === 'string' ? body.email : '';

    return `auth:${ip}:${email}`;
  }

  protected override async throwThrottlingException(_context: ExecutionContext): Promise<void> {
    throw new ThrottlerException('Too many authentication attempts. Please try again later.');
  }
}
