import { describe, it, expect } from 'vitest';
import {
  normalizeRole,
  getPermissionsForRole,
  hasPermission,
  canAccessRoute,
} from '@/lib/auth/rbac';

describe('rbac utilities', () => {
  describe('normalizeRole', () => {
    it('normalizes known roles and defaults unknown roles to viewer', () => {
      expect(normalizeRole('ADMIN')).toBe('admin');
      expect(normalizeRole('manager')).toBe('manager');
      expect(normalizeRole('unknown-role')).toBe('viewer');
      expect(normalizeRole(undefined)).toBe('viewer');
    });
  });

  describe('getPermissionsForRole', () => {
    it('returns admin permissions including user management', () => {
      const perms = getPermissionsForRole('admin');
      expect(perms).toContain('admin:user-manage');
      expect(perms).toContain('admin:view-audit-logs');
    });

    it('returns viewer baseline permissions only', () => {
      const perms = getPermissionsForRole('viewer');
      expect(perms).toContain('portfolio:view');
      expect(perms).not.toContain('admin:user-manage');
      expect(perms).not.toContain('team:manage-roles');
    });
  });

  describe('hasPermission', () => {
    it('checks permission by role mapping', () => {
      expect(hasPermission('auditor', 'admin:view-audit-logs')).toBe(true);
      expect(hasPermission('viewer', 'admin:view-audit-logs')).toBe(false);
    });
  });

  describe('canAccessRoute', () => {
    it('restricts /team to admins', () => {
      expect(canAccessRoute('/team', 'admin').allowed).toBe(true);
      expect(canAccessRoute('/team', 'manager').allowed).toBe(false);
      expect(canAccessRoute('/team/members', 'viewer').allowed).toBe(false);
    });

    it('restricts /audit to admin and auditor', () => {
      expect(canAccessRoute('/audit', 'auditor').allowed).toBe(true);
      expect(canAccessRoute('/audit/logs', 'admin').allowed).toBe(true);
      expect(canAccessRoute('/audit', 'manager').allowed).toBe(false);
    });

    it('allows unrestricted routes', () => {
      expect(canAccessRoute('/marketplace', 'viewer').allowed).toBe(true);
      expect(canAccessRoute('/portfolio', 'analyst').allowed).toBe(true);
    });
  });
});
