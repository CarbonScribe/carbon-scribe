import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacModule } from './rbac.module';
import { RbacService } from './rbac.service';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import {
  CREDIT_RETIRE,
  PORTFOLIO_VIEW,
} from './constants/permissions.constants';

function createContext(user: {
  sub: string;
  role: string;
  companyId: string;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, path: '/api/v1/retirements' }),
    }),
    getHandler: () => (Reflect.getMetadata ? class {} : () => ({})),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RBAC integration', () => {
  let rbacService: RbacService;
  let rolesGuard: RolesGuard;
  let permissionsGuard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [RbacModule],
    }).compile();
    rbacService = module.get<RbacService>(RbacService);
    rolesGuard = module.get<RolesGuard>(RolesGuard);
    permissionsGuard = module.get<PermissionsGuard>(PermissionsGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should resolve RbacService with role-to-permissions', async () => {
    const adminPerms = await rbacService.getUserPermissions(
      'u1',
      'admin',
      'c1',
    );
    const viewerPerms = await rbacService.getUserPermissions(
      'u2',
      'viewer',
      'c2',
    );
    expect(adminPerms).toContain(CREDIT_RETIRE);
    expect(adminPerms).toContain(PORTFOLIO_VIEW);
    expect(viewerPerms).toContain(PORTFOLIO_VIEW);
    expect(viewerPerms).not.toContain(CREDIT_RETIRE);
  });

  it('RolesGuard should allow admin when @Roles("admin")', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const ctx = createContext({ sub: 'u1', role: 'admin', companyId: 'c1' });
    expect(rolesGuard.canActivate(ctx)).toBe(true);
  });

  it('RolesGuard should return 403 for viewer when @Roles("admin")', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const ctx = createContext({ sub: 'u1', role: 'viewer', companyId: 'c1' });
    expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('PermissionsGuard should allow manager for credit:retire', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([CREDIT_RETIRE]);
    const ctx = createContext({ sub: 'u1', role: 'manager', companyId: 'c1' });
    await expect(permissionsGuard.canActivate(ctx)).resolves.toBe(true);
  });

  it('PermissionsGuard should return 403 for viewer for credit:retire', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([CREDIT_RETIRE]);
    const ctx = createContext({ sub: 'u1', role: 'viewer', companyId: 'c1' });
    await expect(permissionsGuard.canActivate(ctx)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('Admin role has all permissions', async () => {
    const perms = await rbacService.getUserPermissions('u1', 'admin', 'c1');
    expect(perms).toContain(CREDIT_RETIRE);
    expect(perms).toContain(PORTFOLIO_VIEW);
    expect(perms).toContain('admin:view-audit-logs');
    expect(perms.length).toBeGreaterThanOrEqual(20);
  });
});
