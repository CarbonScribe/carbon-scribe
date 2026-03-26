import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TenantMiddleware } from './middleware/tenant.middleware';
import { TenantGuard } from './guards/tenant.guard';
import { TenantService } from './tenant.service';
import { TenantContextStore } from './tenant-context.store';

@Global()
@Module({
  providers: [
    TenantService,
    TenantContextStore,
    TenantMiddleware,
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
  ],
  exports: [TenantService, TenantContextStore, TenantMiddleware, TenantGuard],
})
export class TenantModule {}
