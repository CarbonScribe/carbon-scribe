# Multi-tenant Service Module

Centralized tenant isolation for the backend.

## What it does

- Resolves tenant context from each request (`JWT`, `X-Tenant-ID`, subdomain, path).
- Stores request tenant context in `AsyncLocalStorage`.
- Enforces route scope with `TenantGuard`.
- Automatically applies tenant filters in `PrismaService`.

## Tenant Context

```ts
interface TenantContext {
  companyId: string;
  userId: string;
  role: string;
  source: 'jwt' | 'header' | 'subdomain' | 'path' | 'api_key' | 'system';
  bypassIsolation?: boolean;
}
```

## Controller usage

Use `@Tenant()` when you need direct access to the resolved tenant context.

```ts
@Get('summary')
async summary(@Tenant() tenant: TenantContext) {
  return this.analyticsService.getSummary(tenant.companyId);
}
```

If only `companyId` is needed, `@CompanyId()` remains supported and now prioritizes `request.tenant.companyId`.

## API key context

For API key requests, tenant context is resolved as:

- `companyId`: API key company
- `userId`: `api_key:<apiKeyId>`
- `role`: `service`

## Prisma auto-filtering

`PrismaService` reads the request tenant context and applies tenant filtering automatically:

- Direct scope models: `where.companyId = tenant.companyId`
- Relational scope models: relation filters (for example `Credit -> project.companyId`)

Cross-tenant write attempts with an explicit mismatched `companyId` throw `403 Forbidden`.

## Public routes and bypass

Public endpoints (auth entrypoints and external webhooks) are allowlisted to run without tenant context.

System-wide override is supported through:

- `TENANT_SYSTEM_BYPASS_TOKEN`
- request header `x-tenant-bypass-token`

When valid, `bypassIsolation` is enabled for that request.
