# RBAC (Role-Based Access Control) Module

This module provides role-based access control with permissions, authorization guards, and policy enforcement so users can only access resources according to their assigned roles.

## Module structure

- **constants/permissions.constants.ts** – All permission identifiers and role-to-permissions mapping
- **decorators/roles.decorator.ts** – `@Roles()` for role-based restriction
- **decorators/permissions.decorator.ts** – `@Permissions()` for permission-based restriction
- **guards/roles.guard.ts** – `RolesGuard`: enforces `@Roles()`, returns 403 when role not allowed
- **guards/permissions.guard.ts** – `PermissionsGuard`: enforces `@Permissions()`, returns 403 when any required permission is missing
- **rbac.service.ts** – `getUserPermissions()`, `hasPermission()`, `hasAllPermissions()`, permission caching
- **rbac.module.ts** – Registers and exports the service and guards

## Roles and permissions

### Roles

| Role     | Description                          |
|----------|--------------------------------------|
| admin    | Full system access                   |
| analyst  | Data analysis and reporting          |
| manager  | Approve purchases and retirements    |
| viewer   | Read-only access                     |
| auditor  | Compliance and audit log access      |

### Permission categories

- **Portfolio:** `portfolio:view`, `portfolio:export`, `portfolio:analyze`
- **Credit:** `credit:view`, `credit:purchase`, `credit:retire`, `credit:approve-retirement`
- **Report:** `report:view`, `report:generate`, `report:export`, `report:schedule`
- **Team:** `team:view`, `team:invite`, `team:manage-roles`, `team:remove`
- **Compliance:** `compliance:view`, `compliance:submit`, `compliance:audit`
- **Settings:** `settings:view`, `settings:update`, `settings:billing`
- **Admin:** `admin:user-manage`, `admin:view-audit-logs`

Role-to-permissions mapping is defined in `constants/permissions.constants.ts` (`ROLE_PERMISSIONS`). The **admin** role has all permissions.

## Usage

### Applying guards

Guards must run **after** `JwtAuthGuard` so `request.user` (JWT payload with `role`, `companyId`, `sub`) is set.

**Controller-level (all routes protected):**

```ts
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/retirements')
export class RetirementController { ... }
```

**Method-level (restrict by role):**

```ts
import { Roles } from '../rbac/decorators/roles.decorator';

@Roles('admin')
@Get('admin-only')
adminOnly() { ... }

@Roles('manager', 'admin')
@Post('approve')
approve() { ... }
```

**Method-level (restrict by permission):**

```ts
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { CREDIT_RETIRE } from '../rbac/constants/permissions.constants';

@Permissions(CREDIT_RETIRE)
@Post()
retireCredits() { ... }

@Permissions(CREDIT_VIEW, PORTFOLIO_EXPORT)
@Get('export')
exportData() { ... }
```

User must have **all** listed permissions when using `@Permissions(...)`.

### Using the service

Inject `RbacService` when you need to check permissions in code (e.g. in a service or custom guard):

```ts
constructor(private readonly rbac: RbacService) {}

async someMethod(userId: string, role: string, companyId: string) {
  const permissions = await this.rbac.getUserPermissions(userId, role, companyId);
  const canRetire = await this.rbac.hasPermission(userId, role, companyId, 'credit:retire');
  const canDoBoth = await this.rbac.hasAllPermissions(userId, role, companyId, ['credit:retire', 'credit:approve-retirement']);
}
```

### Cache invalidation

Permission lists are cached per role (TTL 5 minutes). If roles or permissions change at runtime:

```ts
this.rbac.invalidatePermissionCache('manager');  // one role
this.rbac.invalidatePermissionCache();           // clear all
```

## Auth and multi-tenant context

- **Auth:** The Auth module includes `role` and `companyId` in the JWT payload. `request.user` after `JwtAuthGuard` has `sub`, `email`, `companyId`, `role`, `sessionId`.
- **Company context:** Permission checks use the user’s `companyId` from the JWT. Enforce company boundaries when loading resources (e.g. filter by `user.companyId` in services) so users only access data for their company.

## Unauthorized access

- **403 Forbidden** is returned when:
  - `RolesGuard`: user’s role is not in the list required by `@Roles()`.
  - `PermissionsGuard`: user lacks any of the permissions required by `@Permissions()`.
- All such denials are logged (with path, userId, role) for security auditing.

## Extending

1. **New permission:** Add a constant in `permissions.constants.ts` and include it in `ALL_PERMISSIONS` and in the right `ROLE_PERMISSIONS` entries.
2. **New role:** Add the role to `ROLES` and define its permissions in `ROLE_PERMISSIONS`.
3. **Per-user overrides:** Extend `RbacService.getUserPermissions()` to load user-specific permissions (e.g. from DB) and merge with role permissions; keep using the same guards and decorators.
