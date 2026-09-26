export interface RateLimitConfigInterface {
  enabled: boolean;
  defaultWindowMs: number;
  defaultMaxRequests: number;
  redisKeyPrefix: string;
  enableMetrics: boolean;
  enableLogging: boolean;
  whitelistEnabled: boolean;
}

export interface BiddingRateLimitConfig {
  perUserPerAuction: {
    max: number;
    windowMs: number;
  };
  globalPerAuction: {
    max: number;
    windowMs: number;
  };
}

export interface RetirementRateLimitConfig {
  perUser: {
    max: number;
    windowMs: number;
  };
  perCompany: {
    max: number;
    windowMs: number;
  };
}

export interface DiscoveryRateLimitConfig {
  similarCredits: {
    max: number;
    windowMs: number;
  };
  search: {
    max: number;
    windowMs: number;
  };
}
