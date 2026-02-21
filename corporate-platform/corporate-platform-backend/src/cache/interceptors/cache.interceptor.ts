import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, of } from 'rxjs';
import { mergeMap, tap } from 'rxjs/operators';
import { CacheService } from '../cache.service';
import { CACHEABLE_METADATA_KEY } from '../decorators/cacheable.decorator';
import { CACHE_EVICT_METADATA_KEY } from '../decorators/cache-evict.decorator';
import { CacheEvictOptions, CacheableOptions } from '../cache.interfaces';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler();
    const target = context.getClass();
    const cacheable =
      this.reflector.getAllAndOverride<CacheableOptions>(
        CACHEABLE_METADATA_KEY,
        [handler, target],
      );
    const evict =
      this.reflector.getAllAndOverride<CacheEvictOptions>(
        CACHE_EVICT_METADATA_KEY,
        [handler, target],
      );

    if (!cacheable && !evict) {
      return next.handle();
    }

    if (evict) {
      const resolved = this.resolveEvictOptions(evict, context.getArgs());
      return from(this.cacheService.evict(resolved)).pipe(
        mergeMap(() => next.handle()),
      );
    }

    if (!cacheable) {
      return next.handle();
    }

    const key = this.buildKey(cacheable.key, context.getArgs());
    const ttl = cacheable.ttl;
    const tags = cacheable.tags;

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

  private buildKey(template: string, args: any[]): string {
    return template.replace(/{([^}]+)}/g, (_, token) => {
      if (/^\d+$/.test(token)) {
        const index = Number(token);
        return args[index] != null ? String(args[index]) : '';
      }
      if (args.length === 1) {
        return String(args[0]);
      }
      for (const arg of args) {
        if (arg && typeof arg === 'object' && token in arg) {
          return String(arg[token]);
        }
      }
      return '';
    });
  }

  private resolveEvictOptions(
    options: CacheEvictOptions,
    args: any[],
  ): CacheEvictOptions {
    const keys = options.keys?.map((k) => this.buildKey(k, args));
    const patterns = options.patterns?.map((p) => this.buildKey(p, args));
    const tags = options.tags;
    return { keys, patterns, tags };
  }
}
