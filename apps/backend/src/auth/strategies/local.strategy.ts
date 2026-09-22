import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, email: string, password: string): Promise<unknown> {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const user = await this.authService.validateUser(email, password, ip);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
