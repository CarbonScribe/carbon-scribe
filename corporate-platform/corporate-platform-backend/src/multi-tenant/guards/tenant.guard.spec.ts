import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantContextStore } from '../tenant-context.store';
import { TenantGuard } from './tenant.guard';
import { TenantService } from '../tenant.service';

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let tenantService: jest.Mocked<TenantService>;
  let tenantContextStore: jest.Mocked<TenantContextStore>;

  beforeEach(() => {
    tenantService = {
      isPublicRoute: jest.fn(),
      extractRouteCompanyId: jest.fn(),
    } as unknown as jest.Mocked<TenantService>;

    tenantContextStore = {
      setContext: jest.fn(),
    } as unknown as jest.Mocked<TenantContextStore>;

    guard = new TenantGuard(tenantService, tenantContextStore);
  });

  function buildContext(request: Partial<Request>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('allows public routes', () => {
    tenantService.isPublicRoute.mockReturnValue(true);
    const context = buildContext({ path: '/api/v1/auth/login' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects missing tenant context on protected routes', () => {
    tenantService.isPublicRoute.mockReturnValue(false);
    const context = buildContext({
      path: '/api/v1/secure',
      tenant: undefined,
      deferredApiKeyResolution: false,
    } as unknown as Request);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('blocks cross-tenant route scope access', () => {
    tenantService.isPublicRoute.mockReturnValue(false);
    tenantService.extractRouteCompanyId.mockReturnValue('company-b');
    const context = buildContext({
      path: '/api/v1/companies/company-b/orders',
      tenant: {
        companyId: 'company-a',
        userId: 'user-1',
        role: 'admin',
        source: 'jwt',
      },
      deferredApiKeyResolution: false,
    } as unknown as Request);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('blocks cross-tenant header scope access', () => {
    tenantService.isPublicRoute.mockReturnValue(false);
    tenantService.extractRouteCompanyId.mockReturnValue(null);
    const context = buildContext({
      headers: { 'x-tenant-id': 'company-b' },
      tenant: {
        companyId: 'company-a',
        userId: 'user-1',
        role: 'admin',
        source: 'jwt',
      },
      deferredApiKeyResolution: false,
    } as unknown as Request);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows cross-tenant route when bypass isolation is enabled', () => {
    tenantService.isPublicRoute.mockReturnValue(false);
    tenantService.extractRouteCompanyId.mockReturnValue('company-b');
    const context = buildContext({
      path: '/api/v1/companies/company-b/orders',
      tenant: {
        companyId: '*',
        userId: 'system:tenant-bypass',
        role: 'system_admin',
        source: 'system',
        bypassIsolation: true,
      },
      deferredApiKeyResolution: false,
    } as unknown as Request);

    expect(guard.canActivate(context)).toBe(true);
  });
});
