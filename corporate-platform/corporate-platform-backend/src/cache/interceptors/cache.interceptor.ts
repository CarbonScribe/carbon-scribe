import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, of } from 'rxjs';
import { mergeMap, tap } from 'rxjs/operators';
import { CacheService } from '../cache.service';
import { CACHEABLE_METADATA_KEY } from '../decorators/cacheable.decorator';
import { CACHE_EVICT_METADATA_KEY } from '../decorators/cache-evict.decorator';
import { CacheEvictOptions, CacheableOptions } from '../cache.interfaces';
import {
  CacheKeyError,
  CacheKeys,
  normalizeRoleScope,
  resolveKeyTemplate,
} from '../cache-keys';

interface TemplateInputs {
  /** Objects named `{token}`s are looked up in, in priority order. */
  sources: unknown[];
  /** Positional handler arguments for `{0}`, `{1}`, ... tokens. */
  args: unknown[];
  /** The authenticated principal, if any. */
  user?: { companyId?: unknown; role?: unknown };
}

/**
 * Applies `@Cacheable` / `@CacheEvict` (#813).
 *
 * Keys are tenant-scoped by default: the caller's company ID and role scope
 * are read from the authenticated request and prepended
 * (`t:{companyId}:r:{role}:`), so the isolation does not depend on every
 * template author remembering to include them. A request without an
 * authenticated tenant, or a template token that cannot be resolved to a
 * primitive, skips caching/eviction entirely and logs a warning instead of
 * producing a shared key.
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler();
    const target = context.getClass();
    const cacheable = this.reflector.getAllAndOverride<CacheableOptions>(
      CACHEABLE_METADATA_KEY,
      [handler, target],
    );
    const evict = this.reflector.getAllAndOverride<CacheEvictOptions>(
      CACHE_EVICT_METADATA_KEY,
      [handler, target],
    );

    if (!cacheable && !evict) {
      return next.handle();
    }

    const inputs = this.templateInputs(context);

    if (evict) {
      const resolved = this.tryResolve(() =>
        this.resolveEvictOptions(evict, inputs),
      );
      if (!resolved) {
        return next.handle();
      }
      return from(this.cacheService.evict(resolved)).pipe(
        mergeMap(() => next.handle()),
      );
    }

    if (!cacheable) {
      return next.handle();
    }

    const resolved = this.tryResolve(() =>
      this.resolveCacheable(cacheable, inputs),
    );
    if (!resolved) {
      return next.handle();
    }
    const { key, tags } = resolved;
    const ttl = cacheable.ttl;

    return from(this.cacheService.get(key)).pipe(
      mergeMap((cached) => {
        if (cached !== undefined) {
          return of(cached);
        }
        return next.handle().pipe(
          tap((response) => {
            this.cacheService.set(key, response, ttl, tags);
          }),
        );
      }),
    );
  }

  private templateInputs(context: ExecutionContext): TemplateInputs {
    const args = context.getArgs?.() ?? [];
    if (context.getType?.() === 'http') {
      const request = context.switchToHttp().getRequest() ?? {};
      return {
        sources: [request.params, request.query, request.body, request.user],
        args: [],
        user: request.user,
      };
    }
    return { sources: args, args };
  }

  private tryResolve<T>(fn: () => T): T | undefined {
    try {
      return fn();
    } catch (e) {
      if (e instanceof CacheKeyError) {
        this.logger.warn(`Skipping cache: ${e.message}`);
        return undefined;
      }
      throw e;
    }
  }

  private requireTenant(inputs: TemplateInputs): {
    companyId: string;
    roleScope: string;
  } {
    const companyId = inputs.user?.companyId;
    if (typeof companyId !== 'string' || companyId.length === 0) {
      throw new CacheKeyError(
        'tenant-scoped cache requires an authenticated companyId',
      );
    }
    return { companyId, roleScope: normalizeRoleScope(inputs.user?.role) };
  }

  private resolveCacheable(
    options: CacheableOptions,
    inputs: TemplateInputs,
  ): { key: string; tags?: string[] } {
    const body = resolveKeyTemplate(options.key, inputs.sources, inputs.args);
    if (options.scope === 'global') {
      return {
        key: CacheKeys.global(body),
        tags: options.tags?.map((t) => CacheKeys.global(t)),
      };
    }
    const { companyId, roleScope } = this.requireTenant(inputs);
    return {
      key: CacheKeys.tenant(companyId, body, roleScope),
      tags: options.tags?.map((t) => CacheKeys.tenantTag(companyId, t)),
    };
  }

  private resolveEvictOptions(
    options: CacheEvictOptions,
    inputs: TemplateInputs,
  ): CacheEvictOptions {
    // Substituted values are glob-escaped in both keys and patterns: an exact
    // key is evicted via a pattern (it must match every role scope of the
    // tenant), so request data must never be able to widen the match.
    const keyBodies = options.keys?.map((k) =>
      resolveKeyTemplate(k, inputs.sources, inputs.args, true),
    );
    const patternBodies = options.patterns?.map((p) =>
      resolveKeyTemplate(p, inputs.sources, inputs.args, true),
    );

    if (options.scope === 'global') {
      return {
        // Global keys have no role dimension: evict them exactly.
        keys: options.keys?.map((k) =>
          CacheKeys.global(resolveKeyTemplate(k, inputs.sources, inputs.args)),
        ),
        patterns: patternBodies?.map((p) => CacheKeys.global(p)),
        tags: options.tags?.map((t) => CacheKeys.global(t)),
      };
    }

    const { companyId } = this.requireTenant(inputs);
    const patterns = [...(keyBodies ?? []), ...(patternBodies ?? [])].map(
      (body) => CacheKeys.tenantAllRolesPattern(companyId, body),
    );
    return {
      patterns: patterns.length ? patterns : undefined,
      tags: options.tags?.map((t) => CacheKeys.tenantTag(companyId, t)),
    };
  }
}
