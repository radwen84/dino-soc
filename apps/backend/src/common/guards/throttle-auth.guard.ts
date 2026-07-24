import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';

@Injectable()
export class AuthThrottleGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Track by IP + email for auth endpoints
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const email = req.body?.email || '';
    return `auth:${ip}:${email}`;
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
  ): Promise<void> {
    throw new ThrottlerException(
      'Too many authentication attempts. Please try again later.',
    );
  }
}
