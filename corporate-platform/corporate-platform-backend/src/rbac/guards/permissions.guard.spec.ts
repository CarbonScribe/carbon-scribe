import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { RbacService } from '../rbac.service';
import { CREDIT_RETIRE } from '../constants/permissions.constants';

function createMockContext(
  user: Record<string, unknown> | undefined,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, path: '/test' }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let rbacService: RbacService;

  beforeEach(() => {
    reflector = new Reflector();
    rbacService = {
      hasAllPermissions: jest.fn(),
    } as unknown as RbacService;
    guard = new PermissionsGuard(reflector, rbacService);
  });

  it('should allow when no permissions metadata', async () => {
    const ctx = createMockContext({
      sub: 'u1',
      role: 'viewer',
      companyId: 'c1',
    });
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(rbacService.hasAllPermissions).not.toHaveBeenCalled();
  });

  it('should allow when user has all required permissions', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([CREDIT_RETIRE]);
    (rbacService.hasAllPermissions as jest.Mock).mockResolvedValue(true);
    const ctx = createMockContext({
      sub: 'u1',
      role: 'manager',
      companyId: 'c1',
    });
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(rbacService.hasAllPermissions).toHaveBeenCalledWith(
      'u1',
      'manager',
      'c1',
      [CREDIT_RETIRE],
    );
  });

  it('should deny when user lacks permission', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([CREDIT_RETIRE]);
    (rbacService.hasAllPermissions as jest.Mock).mockResolvedValue(false);
    const ctx = createMockContext({
      sub: 'u1',
      role: 'viewer',
      companyId: 'c1',
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      /missing required permission/,
    );
  });

  it('should deny when user identity missing', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([CREDIT_RETIRE]);
    const ctx = createMockContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      /user identity required/,
    );
  });
});
