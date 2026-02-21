import { Module, Global } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';

/**
 * RBAC module: role-based access control with permissions, guards, and decorators.
 *
 * Usage:
 * - Import RbacModule in AppModule (or any module that needs guards).
 * - Apply JwtAuthGuard first, then RolesGuard and/or PermissionsGuard.
 * - Use @Roles('admin') or @Permissions('credit:purchase') on controllers/methods.
 *
 * Exports: RbacService, RolesGuard, PermissionsGuard.
 * Decorators and constants are importable from './rbac/...' (no DI needed).
 */
@Global()
@Module({
  providers: [RbacService, RolesGuard, PermissionsGuard],
  exports: [RbacService, RolesGuard, PermissionsGuard],
})
export class RbacModule {}
