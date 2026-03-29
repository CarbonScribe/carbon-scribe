import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Retrieves `companyId` from request context.
 * Priority: request.tenant.companyId -> request.user.companyId -> x-company-id header
 */
export const CompanyId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    if (req.tenant && req.tenant.companyId) return req.tenant.companyId;
    if (req.user && req.user.companyId) return req.user.companyId;
    if (req.headers && req.headers['x-company-id'])
      return req.headers['x-company-id'];
    return undefined;
  },
);
