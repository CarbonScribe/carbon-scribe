import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from './rbac.service';
import {
  ALL_PERMISSIONS,
  CREDIT_RETIRE,
  ADMIN_VIEW_AUDIT_LOGS,
  PORTFOLIO_VIEW,
} from './constants/permissions.constants';

describe('RbacService', () => {
  let service: RbacService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RbacService],
    }).compile();
    service = module.get<RbacService>(RbacService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserPermissions', () => {
    it('should return all permissions for admin', async () => {
      const perms = await service.getUserPermissions('u1', 'admin', 'c1');
      expect(perms).toEqual(expect.arrayContaining([...ALL_PERMISSIONS]));
      expect(perms.length).toBe(ALL_PERMISSIONS.length);
    });

    it('should return viewer permissions for viewer role', async () => {
      const perms = await service.getUserPermissions('u1', 'viewer', 'c1');
      expect(perms).toContain(PORTFOLIO_VIEW);
      expect(perms).not.toContain(CREDIT_RETIRE);
      expect(perms).not.toContain(ADMIN_VIEW_AUDIT_LOGS);
    });

    it('should default unknown role to viewer', async () => {
      const perms = await service.getUserPermissions('u1', 'unknown', 'c1');
      expect(perms).toEqual(
        expect.arrayContaining([PORTFOLIO_VIEW, 'credit:view', 'report:view']),
      );
    });

    it('should return same result from cache on second call', async () => {
      const first = await service.getUserPermissions('u1', 'analyst', 'c1');
      const second = await service.getUserPermissions('u2', 'analyst', 'c2');
      expect(second).toEqual(first);
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has permission', async () => {
      expect(
        await service.hasPermission('u1', 'manager', 'c1', CREDIT_RETIRE),
      ).toBe(true);
    });

    it('should return false when user lacks permission', async () => {
      expect(
        await service.hasPermission('u1', 'viewer', 'c1', CREDIT_RETIRE),
      ).toBe(false);
    });

    it('should return true for admin for any permission', async () => {
      expect(
        await service.hasPermission('u1', 'admin', 'c1', ADMIN_VIEW_AUDIT_LOGS),
      ).toBe(true);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true when user has all', async () => {
      expect(
        await service.hasAllPermissions('u1', 'manager', 'c1', [
          CREDIT_RETIRE,
          PORTFOLIO_VIEW,
        ]),
      ).toBe(true);
    });

    it('should return false when user lacks one', async () => {
      expect(
        await service.hasAllPermissions('u1', 'viewer', 'c1', [
          PORTFOLIO_VIEW,
          CREDIT_RETIRE,
        ]),
      ).toBe(false);
    });

    it('should return true for empty required list', async () => {
      expect(await service.hasAllPermissions('u1', 'viewer', 'c1', [])).toBe(
        true,
      );
    });
  });

  describe('permission cache', () => {
    it('should invalidate cache for role', async () => {
      await service.getUserPermissions('u1', 'viewer', 'c1');
      service.invalidatePermissionCache('viewer');
      const perms = await service.getUserPermissions('u2', 'viewer', 'c2');
      expect(perms).toContain(PORTFOLIO_VIEW);
    });

    it('should clear all cache', async () => {
      await service.getUserPermissions('u1', 'admin', 'c1');
      service.invalidatePermissionCache();
      const perms = await service.getUserPermissions('u2', 'admin', 'c2');
      expect(perms.length).toBe(ALL_PERMISSIONS.length);
    });
  });

  describe('getAllPermissions / getRoles', () => {
    it('should return all permissions', () => {
      expect(service.getAllPermissions()).toEqual(ALL_PERMISSIONS);
    });

    it('should return all roles', () => {
      const roles = service.getRoles();
      expect(roles).toContain('admin');
      expect(roles).toContain('viewer');
      expect(roles.length).toBe(5);
    });
  });
});
