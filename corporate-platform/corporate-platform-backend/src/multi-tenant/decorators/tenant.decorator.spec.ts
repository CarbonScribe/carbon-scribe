import { ExecutionContext } from '@nestjs/common';
import { resolveTenantFromContext } from './tenant.decorator';

describe('@Tenant decorator', () => {
  it('returns tenant context from the request', () => {
    const request = {
      tenant: {
        companyId: 'company-1',
        userId: 'user-1',
        role: 'admin',
        source: 'jwt',
      },
    };

    const ctx = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    const value = resolveTenantFromContext(ctx);

    expect(value).toEqual(request.tenant);
  });
});
