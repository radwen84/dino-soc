import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  id?: string;
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as JwtPayload | undefined;

    if (!user) {
      return undefined;
    }

    // Compatibilité avec les contrôleurs qui utilisent @CurrentUser('id')
    if (data === 'id') {
      return user.id ?? user.sub;
    }

    return data ? (user as any)[data] : user;
  },
);
