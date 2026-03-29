import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { TenantContextStore } from '../tenant-context.store';
import { TenantService } from '../tenant.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly tenantService: TenantService,
    private readonly tenantContextStore: TenantContextStore,
  ) {}

  use(request: Request, _response: Response, next: NextFunction) {
    try {
      const resolution = this.tenantService.resolveTenantFromRequest(request);

      (request as Request & { tenant?: unknown }).tenant = resolution.tenant;
      (
        request as Request & { deferredApiKeyResolution?: boolean }
      ).deferredApiKeyResolution = resolution.deferredApiKeyResolution;

      if (resolution.tenant) {
        this.tenantContextStore.runWithContext(resolution.tenant, next);
        return;
      }

      if (
        resolution.allowWithoutTenant ||
        resolution.deferredApiKeyResolution
      ) {
        this.tenantContextStore.runWithContext(null, next);
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  }
}
