/**
 * Rate limit configuration options
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  message?: string;
  statusCode?: number;
  skipOnError?: boolean;
  enableGraduatedCooldown?: boolean;
}

/**
 * Rate limit decorator options (all fields optional for flexibility)
 */
export interface RateLimitDecoratorOptions {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
  skipOnError?: boolean;
  enableGraduatedCooldown?: boolean;
  message?: string;
  statusCode?: number;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  current: number;
  max: number;
  resetTime: number;
  retryAfter?: number;
  windowMs: number;
}

/**
 * Rate limit violation
 */
export interface RateLimitViolation {
  endpoint: string;
  userId?: string;
  companyId?: string;
  ip: string;
  key: string;
  current: number;
  max: number;
  resetTime: number;
  timestamp: Date;
}

/**
 * Rate limit metrics with per-endpoint tracking
 */
export interface RateLimitMetrics {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  violations: number;
  byEndpoint: Record<
    string,
    {
      requests: number;
      blocked: number;
    }
  >;
}

/**
 * Rate limit endpoint configuration for pre-defined endpoints
 */
export interface RateLimitEndpointConfig {
  limit: number;
  windowSeconds: number;
  keyPrefix: string;
  message?: string;
}

/**
 * Auth endpoint rate limit configurations
 */
export const AUTH_RATE_LIMITS: Record<string, RateLimitEndpointConfig> = {
  login: {
    limit: 5,
    windowSeconds: 15 * 60, // 15 minutes
    keyPrefix: 'login',
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
  register: {
    limit: 3,
    windowSeconds: 60 * 60, // 1 hour
    keyPrefix: 'register',
    message: 'Too many registration attempts. Please try again after 1 hour.',
  },
  refresh: {
    limit: 10,
    windowSeconds: 60 * 60, // 1 hour
    keyPrefix: 'refresh',
    message: 'Too many refresh attempts. Please try again after 1 hour.',
  },
  forgotPassword: {
    limit: 3,
    windowSeconds: 60 * 60, // 1 hour
    keyPrefix: 'forgot-password',
    message: 'Too many password reset requests. Please try again after 1 hour.',
  },
  resetPassword: {
    limit: 3,
    windowSeconds: 60 * 60, // 1 hour
    keyPrefix: 'reset-password',
    message: 'Too many password reset attempts. Please try again after 1 hour.',
  },
  changePassword: {
    limit: 5,
    windowSeconds: 60 * 60, // 1 hour
    keyPrefix: 'change-password',
    message:
      'Too many password change attempts. Please try again after 1 hour.',
  },
  me: {
    limit: 30,
    windowSeconds: 60, // 1 minute
    keyPrefix: 'me',
    message: 'Too many profile requests. Please try again later.',
  },
  sessions: {
    limit: 10,
    windowSeconds: 60, // 1 minute
    keyPrefix: 'sessions',
    message: 'Too many session requests. Please try again later.',
  },
  terminateSession: {
    limit: 5,
    windowSeconds: 60, // 1 minute
    keyPrefix: 'terminate-session',
    message: 'Too many session termination attempts. Please try again later.',
  },
};

/**
 * Convert endpoint config to rate limit config
 */
export function endpointToRateLimitConfig(
  config: RateLimitEndpointConfig,
): RateLimitConfig {
  return {
    windowMs: config.windowSeconds * 1000,
    maxRequests: config.limit,
    keyPrefix: config.keyPrefix,
    message: config.message,
  };
}

/**
 * Default rate limit configuration
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60000, // 1 minute
  maxRequests: 10,
  keyPrefix: 'default',
  message: 'Too many requests, please try again later.',
  statusCode: 429,
  skipOnError: false,
  enableGraduatedCooldown: false,
};
