import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { verify } from 'jsonwebtoken';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ApiKeyAuthContext } from '../api-key/interfaces/api-key.interface';
import { TenantContext } from './interfaces/tenant-context.interface';

type TenantResolution = {
  tenant: TenantContext | null;
  allowWithoutTenant: boolean;
  deferredApiKeyResolution: boolean;
};

@Injectable()
export class TenantService {
  private readonly publicRoutePatterns: RegExp[] = [
    /^\/$/,
    /^\/api\/v1\/auth\/register$/,
    /^\/api\/v1\/auth\/login$/,
    /^\/api\/v1\/auth\/refresh$/,
    /^\/api\/v1\/auth\/logout$/,
    /^\/api\/v1\/auth\/forgot-password$/,
    /^\/api\/v1\/auth\/reset-password$/,
    /^\/api\/v1\/webhooks\/stellar$/,
    /^\/api\/v1\/webhooks\/soroban$/,
    /^\/api\/v1\/webhooks\/transactions\/[^/]+\/status$/,
  ];

  resolveTenantFromRequest(request: Request): TenantResolution {
    if (this.isPublicRoute(request)) {
      return {
        tenant: null,
        allowWithoutTenant: true,
        deferredApiKeyResolution: false,
      };
    }

    if (this.isSystemBypassRequest(request)) {
      return {
        tenant: {
          companyId: '*',
          userId: 'system:tenant-bypass',
          role: 'system_admin',
          source: 'system',
          bypassIsolation: true,
        },
        allowWithoutTenant: false,
        deferredApiKeyResolution: false,
      };
    }

    const jwtPayload = this.extractJwtPayload(request);
    const headerCompanyId = this.extractTenantHeader(request);
    const subdomainCompanyId = this.extractTenantFromSubdomain(request);
    const pathCompanyId = this.extractTenantFromPath(request);

    const candidates = [
      jwtPayload?.companyId ?? null,
      headerCompanyId,
      subdomainCompanyId,
      pathCompanyId,
    ].filter((value): value is string => !!value);

    const distinctCompanies = [...new Set(candidates)];
    if (distinctCompanies.length > 1) {
      throw new ForbiddenException('Conflicting tenant context provided');
    }

    if (jwtPayload?.companyId) {
      return {
        tenant: {
          companyId: jwtPayload.companyId,
          userId: jwtPayload.sub,
          role: jwtPayload.role,
          source: 'jwt',
        },
        allowWithoutTenant: false,
        deferredApiKeyResolution: false,
      };
    }

    const companyId = distinctCompanies[0];
    if (companyId) {
      const source = headerCompanyId
        ? 'header'
        : subdomainCompanyId
          ? 'subdomain'
          : 'path';
      return {
        tenant: {
          companyId,
          userId: 'service:anonymous',
          role: 'service',
          source,
        },
        allowWithoutTenant: false,
        deferredApiKeyResolution: false,
      };
    }

    if (this.shouldDeferToApiKeyGuard(request)) {
      return {
        tenant: null,
        allowWithoutTenant: false,
        deferredApiKeyResolution: true,
      };
    }

    throw new UnauthorizedException('Tenant context is required');
  }

  isPublicRoute(request: Request): boolean {
    const method = request.method.toUpperCase();
    const path = request.path || request.url || '';

    if (method === 'GET' && path === '/') {
      return true;
    }

    return this.publicRoutePatterns.some((pattern) => pattern.test(path));
  }

  extractRouteCompanyId(request: Request): string | null {
    const direct = (request.params?.companyId as string | undefined) ?? null;
    if (direct) {
      return direct;
    }
    return this.extractTenantFromPath(request);
  }

  resolveTenantFromApiKey(apiKey: ApiKeyAuthContext): TenantContext {
    return {
      companyId: apiKey.companyId,
      userId: `api_key:${apiKey.id}`,
      role: 'service',
      source: 'api_key',
    };
  }

  private shouldDeferToApiKeyGuard(request: Request): boolean {
    const path = request.path || request.url || '';
    if (!path.startsWith('/api/v1/integrations/')) {
      return false;
    }

    const xApiKey = request.headers['x-api-key'];
    if (typeof xApiKey === 'string' && xApiKey.trim().length > 0) {
      return true;
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return false;
    }

    const [scheme, token] = authorization.split(' ');
    if (!scheme || !token) {
      return false;
    }

    const normalized = scheme.toLowerCase();
    if (normalized === 'apikey') {
      return true;
    }

    if (normalized === 'bearer' && token.startsWith('sk_')) {
      return true;
    }

    return false;
  }

  private extractJwtPayload(request: Request): JwtPayload | null {
    const authorization = request.headers.authorization;
    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(' ');
    if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
      return null;
    }

    if (!this.isJwt(token)) {
      return null;
    }

    try {
      const secret = process.env.JWT_SECRET || 'dev-jwt-secret';
      const payload = verify(token, secret) as JwtPayload;
      if (!payload?.companyId || !payload?.sub || !payload?.role) {
        throw new UnauthorizedException('Invalid JWT tenant context');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid JWT');
    }
  }

  private extractTenantHeader(request: Request): string | null {
    const raw = request.headers['x-tenant-id'];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
    if (Array.isArray(raw) && raw[0]?.trim().length) {
      return raw[0].trim();
    }
    return null;
  }

  private extractTenantFromSubdomain(request: Request): string | null {
    const host = request.headers.host;
    if (!host) {
      return null;
    }

    const hostname = host.split(':')[0];
    const baseDomain = process.env.TENANT_BASE_DOMAIN;
    if (!baseDomain) {
      return null;
    }

    const normalizedBase = baseDomain.replace(/^\./, '').toLowerCase();
    const normalizedHost = hostname.toLowerCase();
    if (
      normalizedHost === normalizedBase ||
      !normalizedHost.endsWith(`.${normalizedBase}`)
    ) {
      return null;
    }

    const suffix = `.${normalizedBase}`;
    const subdomain = normalizedHost.slice(0, -suffix.length).split('.')[0];
    return subdomain || null;
  }

  private extractTenantFromPath(request: Request): string | null {
    const path = request.path || request.url || '';
    const match = path.match(/\/companies\/([^/]+)/);
    if (!match || !match[1]) {
      return null;
    }
    return decodeURIComponent(match[1]);
  }

  private isSystemBypassRequest(request: Request): boolean {
    const token = process.env.TENANT_SYSTEM_BYPASS_TOKEN;
    if (!token) {
      return false;
    }

    const provided = request.headers['x-tenant-bypass-token'];
    if (typeof provided === 'string') {
      return provided === token;
    }
    if (Array.isArray(provided) && provided.length > 0) {
      return provided[0] === token;
    }
    return false;
  }

  private isJwt(token: string): boolean {
    const sections = token.split('.');
    return sections.length === 3 && sections.every((section) => section.length);
  }
}
