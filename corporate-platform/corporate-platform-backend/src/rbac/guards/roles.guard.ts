import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../constants/permissions.constants';

/** JWT payload shape (matches request.user after JwtAuthGuard) */
export interface RequestUserWithRole {
  sub: string;
  email?: string;
  companyId: string;
  role: string;
  sessionId?: string;
}

/**
 * Guard that restricts access by role.
 * Apply after JwtAuthGuard so request.user is populated.
 * Returns 403 Forbidden when user role is not in the allowed list.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUserWithRole | undefined;

    if (!user?.role) {
      this.logger.warn(
        `RBAC denied: no role (userId=${user?.sub ?? 'unknown'}, path=${request.path})`,
      );
      throw new ForbiddenException('Access denied: no role assigned');
    }

    const hasRole = requiredRoles.includes(user.role as Role);
    if (!hasRole) {
      this.logger.warn(
        `RBAC denied: role ${user.role} not in [${requiredRoles.join(', ')}] (userId=${user.sub}, path=${request.path})`,
      );
      throw new ForbiddenException(
        `Access denied: requires one of [${requiredRoles.join(', ')}]`,
      );
    }

    return true;
  }
}
