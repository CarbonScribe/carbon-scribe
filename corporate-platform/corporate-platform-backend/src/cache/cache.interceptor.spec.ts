import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { CacheInterceptor } from './interceptors/cache.interceptor';
import { CacheService } from './cache.service';
import { Cacheable } from './decorators/cacheable.decorator';
import { CacheEvict } from './decorators/cache-evict.decorator';

class TestController {
  @Cacheable({ key: 'portfolio:{portfolioId}', ttl: 60, tags: ['portfolio'] })
  getPortfolio() {}

  @Cacheable({ key: 'reference:countries', scope: 'global', ttl: 60 })
  getCountries() {}

  @Cacheable({ key: 'portfolio:{missing}' })
  unresolved() {}

  @Cacheable({ key: 'filter:{filter}' })
  objectToken() {}

  @CacheEvict({
    keys: ['portfolio:{portfolioId}'],
    patterns: ['portfolio:*'],
    tags: ['portfolio'],
  })
  updatePortfolio() {}

  @CacheEvict({ keys: ['portfolio:{missing}'] })
  unresolvedEvict() {}

  @CacheEvict({ patterns: ['reference:*'], scope: 'global' })
  refreshReference() {}

  @CacheEvict({ keys: ['portfolio:{portfolioId}'] })
  evictWithGlobInput() {}
}

type User = { companyId?: string; role?: string } | undefined;

function httpContext(
  handler: keyof TestController,
  user: User,
  request: { params?: any; query?: any; body?: any } = {},
): any {
  const req = { params: {}, query: {}, body: {}, ...request, user };
  return {
    getHandler: () => TestController.prototype[handler],
    getClass: () => TestController,
    getType: () => 'http',
    getArgs: () => [req, {}, () => undefined],
    switchToHttp: () => ({ getRequest: () => req }),
  };
}

describe('CacheInterceptor (#813 tenant isolation)', () => {
  let interceptor: CacheInterceptor;
  let cacheService: {
    get: jest.Mock;
    set: jest.Mock;
    evict: jest.Mock;
  };
  let handlerCalls: number;
  const next = {
    handle: () => {
      handlerCalls += 1;
      return of({ ok: true });
    },
  };

  beforeEach(() => {
    handlerCalls = 0;
    cacheService = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn(),
      evict: jest.fn().mockResolvedValue(undefined),
    };
    interceptor = new CacheInterceptor(
      cacheService as unknown as CacheService,
      new Reflector(),
    );
  });

  const run = (ctx: any) => lastValueFrom(interceptor.intercept(ctx, next));

  it('passes through without metadata', async () => {
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
    await expect(run(ctx)).resolves.toEqual({ ok: true });
    expect(cacheService.get).not.toHaveBeenCalled();
  });

  it('gives two tenants calling the same endpoint separate keys', async () => {
    const params = { params: { portfolioId: 'p1' } };
    await run(
      httpContext('getPortfolio', { companyId: 'c1', role: 'viewer' }, params),
    );
    await run(
      httpContext('getPortfolio', { companyId: 'c2', role: 'viewer' }, params),
    );

    expect(cacheService.get).toHaveBeenNthCalledWith(
      1,
      't:c1:r:viewer:portfolio:p1',
    );
    expect(cacheService.get).toHaveBeenNthCalledWith(
      2,
      't:c2:r:viewer:portfolio:p1',
    );
    expect(cacheService.set).toHaveBeenCalledWith(
      't:c1:r:viewer:portfolio:p1',
      { ok: true },
      60,
      ['t:c1:portfolio'],
    );
  });

  it('caches role-dependent responses separately per role scope', async () => {
    const params = { params: { portfolioId: 'p1' } };
    await run(
      httpContext('getPortfolio', { companyId: 'c1', role: 'ADMIN' }, params),
    );
    await run(
      httpContext('getPortfolio', { companyId: 'c1', role: 'viewer' }, params),
    );

    expect(cacheService.get.mock.calls.map((c) => c[0])).toEqual([
      't:c1:r:admin:portfolio:p1',
      't:c1:r:viewer:portfolio:p1',
    ]);
  });

  it('serves a hit from the tenant key without calling the handler', async () => {
    cacheService.get.mockResolvedValueOnce({ cached: true });
    const result = await run(
      httpContext(
        'getPortfolio',
        { companyId: 'c1', role: 'viewer' },
        { params: { portfolioId: 'p1' } },
      ),
    );
    expect(result).toEqual({ cached: true });
    expect(handlerCalls).toBe(0);
  });

  it('does not cache when a template token cannot be resolved', async () => {
    const result = await run(
      httpContext('unresolved', { companyId: 'c1', role: 'viewer' }),
    );
    expect(result).toEqual({ ok: true });
    expect(handlerCalls).toBe(1);
    expect(cacheService.get).not.toHaveBeenCalled();
    expect(cacheService.set).not.toHaveBeenCalled();
  });

  it('does not cache when a token resolves to an object (no [object Object] keys)', async () => {
    await run(
      httpContext(
        'objectToken',
        { companyId: 'c1', role: 'viewer' },
        { query: { filter: { a: 1 } } },
      ),
    );
    expect(cacheService.get).not.toHaveBeenCalled();
    expect(cacheService.set).not.toHaveBeenCalled();
  });

  it('never caches tenant-scoped data without an authenticated tenant', async () => {
    await run(
      httpContext('getPortfolio', undefined, {
        params: { portfolioId: 'p1' },
      }),
    );
    expect(handlerCalls).toBe(1);
    expect(cacheService.get).not.toHaveBeenCalled();
    expect(cacheService.set).not.toHaveBeenCalled();
  });

  it('uses the global namespace only when the decorator opts in', async () => {
    await run(httpContext('getCountries', { companyId: 'c1', role: 'viewer' }));
    await run(httpContext('getCountries', undefined));
    expect(cacheService.get.mock.calls.map((c) => c[0])).toEqual([
      'g:reference:countries',
      'g:reference:countries',
    ]);
  });

  it("scopes eviction to the current tenant's keys across all of its roles", async () => {
    await run(
      httpContext(
        'updatePortfolio',
        { companyId: 'c1', role: 'admin' },
        { params: { portfolioId: 'p1' } },
      ),
    );

    expect(cacheService.evict).toHaveBeenCalledWith({
      patterns: ['t:c1:r:*:portfolio:p1', 't:c1:r:*:portfolio:*'],
      tags: ['t:c1:portfolio'],
    });
    const evicted = cacheService.evict.mock.calls[0][0];
    for (const pattern of evicted.patterns) {
      expect(pattern.startsWith('t:c1:')).toBe(true);
    }
    expect(handlerCalls).toBe(1);
  });

  it('skips eviction when a token is unresolved instead of wiping a broad pattern', async () => {
    await run(httpContext('unresolvedEvict', { companyId: 'c1', role: 'a' }));
    expect(cacheService.evict).not.toHaveBeenCalled();
    expect(handlerCalls).toBe(1);
  });

  it('skips tenant eviction without an authenticated tenant', async () => {
    await run(
      httpContext('updatePortfolio', undefined, {
        params: { portfolioId: 'p1' },
      }),
    );
    expect(cacheService.evict).not.toHaveBeenCalled();
  });

  it('escapes glob characters in request data used for eviction', async () => {
    await run(
      httpContext(
        'evictWithGlobInput',
        { companyId: 'c1', role: 'admin' },
        { params: { portfolioId: '*' } },
      ),
    );
    expect(cacheService.evict).toHaveBeenCalledWith({
      patterns: ['t:c1:r:*:portfolio:\\*'],
      tags: undefined,
    });
  });

  it('evicts global entries only when the decorator opts in', async () => {
    await run(httpContext('refreshReference', { companyId: 'c1' }));
    expect(cacheService.evict).toHaveBeenCalledWith({
      keys: undefined,
      patterns: ['g:reference:*'],
      tags: undefined,
    });
  });
});
