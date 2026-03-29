import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantContextStore } from '../tenant-context.store';
import { TenantContext } from '../interfaces/tenant-context.interface';
import { TenantService } from '../tenant.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly tenantService: TenantService,
    private readonly tenantContextStore: TenantContextStore,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (this.tenantService.isPublicRoute(request)) {
      return true;
    }

    const tenant = (request as Request & { tenant?: TenantContext }).tenant;
    const deferredApiKeyResolution = Boolean(
      (request as Request & { deferredApiKeyResolution?: boolean })
        .deferredApiKeyResolution,
    );

    if (!tenant && deferredApiKeyResolution) {
      return true;
    }

    if (!tenant) {
      throw new UnauthorizedException('Tenant context is required');
    }

    this.validateRouteScope(request, tenant);
    this.validateHeaderScope(request, tenant);
    this.validateUserScope(request, tenant);

    this.tenantContextStore.setContext(tenant);
    return true;
  }

  private validateRouteScope(request: Request, tenant: TenantContext): void {
    const routeCompanyId = this.tenantService.extractRouteCompanyId(request);
    if (
      routeCompanyId &&
      !tenant.bypassIsolation &&
      routeCompanyId !== tenant.companyId
    ) {
      throw new ForbiddenException('Cross-tenant route access is forbidden');
    }
  }

  private validateHeaderScope(request: Request, tenant: TenantContext): void {
    const headers = request.headers ?? {};
    const raw = headers['x-tenant-id'];
    const companyId =
      typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
    if (
      companyId &&
      !tenant.bypassIsolation &&
      companyId.trim() !== tenant.companyId
    ) {
      throw new ForbiddenException('Cross-tenant header scope is forbidden');
    }
  }

  private validateUserScope(request: Request, tenant: TenantContext): void {
    const user = (request as Request & { user?: { companyId?: string } }).user;
    if (
      user?.companyId &&
      !tenant.bypassIsolation &&
      user.companyId !== tenant.companyId
    ) {
      throw new ForbiddenException('Cross-tenant identity scope is forbidden');
    }
  }
}
