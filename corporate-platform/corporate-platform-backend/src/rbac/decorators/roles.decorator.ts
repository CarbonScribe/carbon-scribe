import { SetMetadata } from '@nestjs/common';
import { Role } from '../constants/permissions.constants';

export const ROLES_KEY = 'roles';

/**
 * Restrict route access to one or more roles.
 * Use with RolesGuard (after JwtAuthGuard so request.user is set).
 *
 * @example
 * @Roles('admin')
 * @Get('admin-only')
 * adminOnly() { ... }
 *
 * @Roles('manager', 'admin')
 * @Post('approve')
 * approve() { ... }
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
