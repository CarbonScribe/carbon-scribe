import type { Project } from './projects.types';

// Configurable TTL for the stale-while-revalidate cache.
export const PROJECTS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface ProjectsCacheEntry {
  projects: Project[];
  fetchedAt: number;
}

export type ProjectsCache = Record<string, ProjectsCacheEntry>;

/**
 * Cache is keyed by limit/offset only. Status/type/search filters are
 * applied client-side (see projects.selectors.ts) and never hit the API,
 * so they don't need to participate in the cache key.
 */
export function makeProjectsCacheKey(limit: number, offset: number): string {
  return `${limit}:${offset}`;
}

export function isCacheEntryStale(
  entry: ProjectsCacheEntry | undefined,
  ttlMs: number = PROJECTS_CACHE_TTL_MS
): boolean {
  if (!entry) return true;
  return Date.now() - entry.fetchedAt > ttlMs;
}