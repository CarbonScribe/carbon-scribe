/**
 * Cache configuration constants for the application
 */

export const CACHE_CONFIG = {
  /** Static assets - 1 year, immutable */
  STATIC_ASSETS: {
    'Cache-Control': 'public, max-age=31536000, immutable',
  },

  /** HTML pages - 60s CDN cache, 5min stale-while-revalidate */
  PAGES: {
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
  },

  /** API GET responses - 30s CDN cache, 60s stale-while-revalidate */
  API_GET: {
    'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
  },

  /** API POST/PUT/PATCH - no cache, must revalidate */
  API_MUTATION: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  },

  /** Error responses - short TTL to prevent stale error caching */
  ERROR: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  },

  /** Images - 1 year, immutable */
  IMAGES: {
    'Cache-Control': 'public, max-age=31536000, immutable',
  },

  /** Fonts - 1 year, immutable */
  FONTS: {
    'Cache-Control': 'public, max-age=31536000, immutable',
  },

  /** Marketplace search results - 10s stale-while-revalidate */
  SEARCH_RESULTS: {
    'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
  },
} as const;

export type CacheControlType = keyof typeof CACHE_CONFIG;