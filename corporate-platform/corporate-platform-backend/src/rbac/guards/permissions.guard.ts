import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission } from '../constants/permissions.constants';
import { RbacService } from '../rbac.service';

/** JWT payload shape (matches request.user after JwtAuthGuard) */
export interface RequestUserForPermissions {
  sub: string;
  email?: string;
  companyId: string;
  role: string;
  sessionId?: string;
}

/**
 * Guard that restricts access by permission(s).
 * User must have ALL listed permissions.
 * Apply after JwtAuthGuard so request.user is populated.
 * Returns 403 Forbidden when user lacks any required permission.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUserForPermissions | undefined;

    if (!user?.sub || !user?.role) {
      this.logger.warn(`RBAC denied: no user identity (path=${request.path})`);
      throw new ForbiddenException('Access denied: user identity required');
    }

    const hasAll = await this.rbacService.hasAllPermissions(
      user.sub,
      user.role,
      user.companyId,
      requiredPermissions,
    );

    if (!hasAll) {
      this.logger.warn(
        `RBAC denied: missing permission(s) [${requiredPermissions.join(', ')}] (userId=${user.sub}, role=${user.role}, path=${request.path})`,
      );
      throw new ForbiddenException(
        `Access denied: missing required permission(s)`,
      );
    }

    return true;
  }
}
