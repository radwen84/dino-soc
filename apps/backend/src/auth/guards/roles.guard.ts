import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si aucun rôle n'est spécifié sur la route/contrôleur, autoriser l'accès
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user || !user.roles || !Array.isArray(user.roles)) {
      throw new ForbiddenException('Access denied: no roles assigned');
    }

    // Normalisation en minuscules pour éliminer la sensibilité à la casse ('admin' vs 'ADMIN')
    const normalizedRequiredRoles = requiredRoles.map((r) => r.toLowerCase());
    const userRoles = user.roles.map((r) => r.toLowerCase());

    const hasRole = userRoles.some((role) => normalizedRequiredRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(`Access denied: requires one of [${requiredRoles.join(', ')}]`);
    }

    return true;
  }
}