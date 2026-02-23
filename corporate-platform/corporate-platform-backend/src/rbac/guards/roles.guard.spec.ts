import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

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

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow when no roles metadata', () => {
    const ctx = createMockContext({ role: 'viewer' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow when user has required role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['viewer', 'admin']);
    const ctx = createMockContext({
      sub: 'u1',
      role: 'viewer',
      companyId: 'c1',
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny when user role not in required list', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const ctx = createMockContext({
      sub: 'u1',
      role: 'viewer',
      companyId: 'c1',
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow(/requires one of/);
  });

  it('should deny when user has no role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['viewer']);
    const ctx = createMockContext({ sub: 'u1', companyId: 'c1' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow(/no role assigned/);
  });

  it('should deny when user is undefined', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['viewer']);
    const ctx = createMockContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
