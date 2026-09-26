/**
 * Health monitoring constants
 */

export const HEALTH_CONSTANTS = {
  /** Default SLA target for uptime (99.9%) */
  DEFAULT_SLA_TARGET: 99.9,

  /** Polling interval for uptime data (60 seconds) */
  UPTIME_POLL_INTERVAL_MS: 60000,

  /** Default period for uptime display */
  DEFAULT_PERIOD: '30d',

  /** Available uptime periods */
  PERIODS: ['7d', '30d', '90d'] as const,

  /** Default P99 latency (fallback when metrics unavailable) */
  DEFAULT_P99_LATENCY: '142ms',
} as const;

export type UptimePeriod = typeof HEALTH_CONSTANTS.PERIODS[number];