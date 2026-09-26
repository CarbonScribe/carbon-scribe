/**
 * SWR configuration for data fetching with caching
 */

export const SWR_CONFIG = {
  /** Default SWR configuration */
  default: {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 60000, // 1 minute
    dedupingInterval: 5000, // 5 seconds
    errorRetryCount: 3,
    errorRetryInterval: 5000,
    shouldRetryOnError: true,
  },

  /** Marketplace search - aggressive caching */
  marketplace: {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 30000, // 30 seconds
    dedupingInterval: 10000, // 10 seconds
    errorRetryCount: 2,
    errorRetryInterval: 3000,
  },

  /** Credit details - stale-while-revalidate */
  creditDetails: {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: 120000, // 2 minutes
    dedupingInterval: 30000, // 30 seconds
    errorRetryCount: 3,
    errorRetryInterval: 5000,
  },

  /** Portfolio analytics - longer cache */
  portfolio: {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 300000, // 5 minutes
    dedupingInterval: 60000, // 1 minute
    errorRetryCount: 2,
    errorRetryInterval: 10000,
  },

  /** Real-time data - short cache */
  realtime: {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: 10000, // 10 seconds
    dedupingInterval: 2000, // 2 seconds
    errorRetryCount: 3,
    errorRetryInterval: 2000,
  },
} as const;

export type SwrConfigType = keyof typeof SWR_CONFIG;