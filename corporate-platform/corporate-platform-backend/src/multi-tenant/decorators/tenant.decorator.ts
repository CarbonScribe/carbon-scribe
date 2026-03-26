import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext } from '../interfaces/tenant-context.interface';

export function resolveTenantFromContext(
  ctx: ExecutionContext,
): TenantContext | undefined {
  const request = ctx.switchToHttp().getRequest();
  return request.tenant as TenantContext | undefined;
}

export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext | undefined => {
    return resolveTenantFromContext(ctx);
  },
);
