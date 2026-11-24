import { CacheScope } from './cache-keys';

export interface CacheableOptions {
  key: string;
  ttl?: number;
  tags?: string[];
  /**
   * `tenant` (default): the key is prefixed with the caller's company ID and
   * role scope (`t:{companyId}:r:{role}:`) and is never cached without an
   * authenticated tenant. `global`: shared by every tenant (`g:` prefix);
   * only use for data that is identical for all callers.
   */
  scope?: CacheScope;
}

export interface CacheEvictOptions {
  keys?: string[];
  patterns?: string[];
  tags?: string[];
  /**
   * `tenant` (default): only the current tenant's entries (across all of its
   * role scopes) are evicted. `global`: evicts `g:`-namespaced entries.
   */
  scope?: CacheScope;
}

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  memoryUsage?: number;
  evictions?: number;
}
