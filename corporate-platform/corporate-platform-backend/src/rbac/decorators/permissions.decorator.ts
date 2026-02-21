import { SetMetadata } from '@nestjs/common';
import { Permission } from '../constants/permissions.constants';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Require one or more permissions (user must have ALL listed permissions).
 * Use with PermissionsGuard (after JwtAuthGuard so request.user is set).
 *
 * @example
 * @Permissions('credit:purchase')
 * @Post('purchase')
 * purchase() { ... }
 *
 * @Permissions('credit:retire', 'credit:approve-retirement')
 * @Post('retire')
 * retire() { ... }
 */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
