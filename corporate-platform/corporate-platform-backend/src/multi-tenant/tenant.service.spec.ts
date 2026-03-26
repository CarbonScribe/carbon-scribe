import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { Request } from 'express';
import { TenantService } from './tenant.service';

describe('TenantService', () => {
  let service: TenantService;

  beforeEach(() => {
    service = new TenantService();
    process.env.JWT_SECRET = 'tenant-test-secret';
    process.env.TENANT_BASE_DOMAIN = 'platform.com';
    delete process.env.TENANT_SYSTEM_BYPASS_TOKEN;
  });

  function buildRequest(
    overrides: Partial<Request> = {},
  ): Request & { params: Record<string, string> } {
    const request = {
      method: 'GET',
      path: '/api/v1/secure',
      url: '/api/v1/secure',
      headers: {},
      params: {},
      ...overrides,
    } as Request & { params: Record<string, string> };
    return request;
  }

  it('extracts tenant context from a JWT', () => {
    const token = sign(
      {
        sub: 'user-1',
        companyId: 'company-1',
        role: 'admin',
      },
      process.env.JWT_SECRET as string,
    );

    const request = buildRequest({
      headers: { authorization: `Bearer ${token}` },
    } as Partial<Request>);

    const resolution = service.resolveTenantFromRequest(request);

    expect(resolution.tenant).toEqual(
      expect.objectContaining({
        companyId: 'company-1',
        userId: 'user-1',
        role: 'admin',
        source: 'jwt',
      }),
    );
    expect(resolution.deferredApiKeyResolution).toBe(false);
    expect(resolution.allowWithoutTenant).toBe(false);
  });

  it('rejects conflicting tenant sources', () => {
    const token = sign(
      {
        sub: 'user-1',
        companyId: 'company-a',
        role: 'viewer',
      },
      process.env.JWT_SECRET as string,
    );

    const request = buildRequest({
      headers: {
        authorization: `Bearer ${token}`,
        'x-tenant-id': 'company-b',
      },
    } as Partial<Request>);

    expect(() => service.resolveTenantFromRequest(request)).toThrow(
      ForbiddenException,
    );
  });

  it('defers integrations requests authenticated by API key', () => {
    const request = buildRequest({
      path: '/api/v1/integrations/retirement-analytics/summary',
      headers: { 'x-api-key': 'sk_live_test' },
    } as Partial<Request>);

    const resolution = service.resolveTenantFromRequest(request);
    expect(resolution.tenant).toBeNull();
    expect(resolution.allowWithoutTenant).toBe(false);
    expect(resolution.deferredApiKeyResolution).toBe(true);
  });

  it('extracts tenant from subdomain when base domain matches', () => {
    const request = buildRequest({
      headers: { host: 'company-sub.platform.com' },
    } as Partial<Request>);

    const resolution = service.resolveTenantFromRequest(request);
    expect(resolution.tenant).toEqual(
      expect.objectContaining({
        companyId: 'company-sub',
        source: 'subdomain',
      }),
    );
  });

  it('extracts tenant from /companies/:companyId path', () => {
    const request = buildRequest({
      path: '/api/v1/companies/company-path/portfolio',
      url: '/api/v1/companies/company-path/portfolio',
    } as Partial<Request>);

    const resolution = service.resolveTenantFromRequest(request);
    expect(resolution.tenant).toEqual(
      expect.objectContaining({
        companyId: 'company-path',
        source: 'path',
      }),
    );
  });

  it('allows public auth routes without tenant context', () => {
    const request = buildRequest({
      method: 'POST',
      path: '/api/v1/auth/login',
    } as Partial<Request>);

    const resolution = service.resolveTenantFromRequest(request);
    expect(resolution.tenant).toBeNull();
    expect(resolution.allowWithoutTenant).toBe(true);
  });

  it('rejects malformed bearer tokens', () => {
    const request = buildRequest({
      headers: { authorization: 'Bearer malformed-token' },
    } as Partial<Request>);

    expect(() => service.resolveTenantFromRequest(request)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects empty tenant headers on protected routes', () => {
    const request = buildRequest({
      headers: { 'x-tenant-id': '   ' },
    } as Partial<Request>);

    expect(() => service.resolveTenantFromRequest(request)).toThrow(
      UnauthorizedException,
    );
  });

  it('allows system bypass with configured token', () => {
    process.env.TENANT_SYSTEM_BYPASS_TOKEN = 'tenant-bypass-secret';
    const request = buildRequest({
      headers: { 'x-tenant-bypass-token': 'tenant-bypass-secret' },
    } as Partial<Request>);

    const resolution = service.resolveTenantFromRequest(request);
    expect(resolution.tenant).toEqual(
      expect.objectContaining({
        source: 'system',
        bypassIsolation: true,
        companyId: '*',
      }),
    );
  });

  it('rejects protected route without tenant context', () => {
    const request = buildRequest();
    expect(() => service.resolveTenantFromRequest(request)).toThrow(
      UnauthorizedException,
    );
  });
});
