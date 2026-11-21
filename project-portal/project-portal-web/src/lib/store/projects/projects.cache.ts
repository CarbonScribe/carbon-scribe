import type { Project, ProjectFilters } from './projects.types';

// Configurable TTL for the stale-while-revalidate cache.
export const PROJECTS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface ProjectsCacheEntry {
  projects: Project[];
  fetchedAt: number;
}

export type ProjectsCache = Record<string, ProjectsCacheEntry>;

/**
 * Filter values are part of the key so pages from different server queries
 * can never be served as though they belonged to one another.
 */
export function makeProjectsCacheKey(
  limit: number,
  offset: number,
  filters: ProjectFilters = { search: '', type: 'All', status: 'All' }
): string {
  const baseKey = `${limit}:${offset}`;
  if (!filters.search && filters.type === 'All' && filters.status === 'All') {
    return baseKey;
  }
  return `${baseKey}:${JSON.stringify([filters.search, filters.type, filters.status])}`;
}

export function isCacheEntryStale(
  entry: ProjectsCacheEntry | undefined,
  ttlMs: number = PROJECTS_CACHE_TTL_MS
): boolean {
  if (!entry) return true;
  return Date.now() - entry.fetchedAt > ttlMs;
}