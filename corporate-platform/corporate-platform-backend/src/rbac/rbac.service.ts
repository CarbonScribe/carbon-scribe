import { Injectable } from '@nestjs/common';
import {
  ALL_PERMISSIONS,
  Permission,
  Role,
  ROLE_PERMISSIONS,
  ROLES,
} from './constants/permissions.constants';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  permissions: Permission[];
  expiresAt: number;
}

/**
 * RBAC service: permission resolution and checking with role-based mapping.
 * Permissions are cached per role for performance.
 */
@Injectable()
export class RbacService {
  private readonly permissionCache = new Map<string, CacheEntry>();

  /**
   * Returns the full list of permissions for a user based on their role.
   * Uses in-memory cache keyed by role; pass companyId for future multi-tenant overrides.
   */
  async getUserPermissions(
    _userId: string,
    role: string,
    _companyId?: string, // reserved for per-company overrides
  ): Promise<Permission[]> {
    void _userId;
    void _companyId;
    const normalizedRole = this.normalizeRole(role);
    const cacheKey = `role:${normalizedRole}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }
    const permissions = this.getPermissionsForRole(normalizedRole);
    this.setCache(cacheKey, permissions);
    return permissions;
  }

  /**
   * Checks if the user has a single permission.
   */
  async hasPermission(
    userId: string,
    role: string,
    companyId: string | undefined,
    permission: Permission,
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, role, companyId);
    return permissions.includes(permission);
  }

  /**
   * Checks if the user has all of the given permissions.
   */
  async hasAllPermissions(
    userId: string,
    role: string,
    companyId: string | undefined,
    required: Permission[],
  ): Promise<boolean> {
    if (required.length === 0) return true;
    const userPermissions = await this.getUserPermissions(
      userId,
      role,
      companyId,
    );
    return required.every((p) => userPermissions.includes(p));
  }

  /**
   * Invalidates permission cache for a role (e.g. after role change).
   * Pass no args to clear entire cache.
   */
  invalidatePermissionCache(role?: string): void {
    if (role) {
      this.permissionCache.delete(`role:${this.normalizeRole(role)}`);
    } else {
      this.permissionCache.clear();
    }
  }

  private normalizeRole(role: string): Role {
    const lower = role?.toLowerCase() ?? 'viewer';
    if (ROLES.includes(lower as Role)) {
      return lower as Role;
    }
    return 'viewer';
  }

  private getPermissionsForRole(role: Role): Permission[] {
    return [...(ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.viewer)];
  }

  private getCached(key: string): Permission[] | null {
    const entry = this.permissionCache.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      if (entry) this.permissionCache.delete(key);
      return null;
    }
    return entry.permissions;
  }

  private setCache(key: string, permissions: Permission[]): void {
    this.permissionCache.set(key, {
      permissions,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  /** Expose all permissions (for docs/tooling). */
  getAllPermissions(): readonly Permission[] {
    return ALL_PERMISSIONS;
  }

  /** Expose role list (for docs/tooling). */
  getRoles(): readonly Role[] {
    return ROLES;
  }
}
