import { SetMetadata } from '@nestjs/common';
import { RateLimitDecoratorOptions } from './rate-limit.types';

export const RATE_LIMIT_KEY = 'rate_limit';

/**
 * Decorator to apply rate limiting to an endpoint
 *
 * @param options - Rate limit configuration options
 * @example
 * @RateLimit({ max: 5, windowMs: 60000, keyPrefix: 'place-bid' })
 * async placeBid() { ... }
 */
export function RateLimit(options: RateLimitDecoratorOptions) {
  return SetMetadata(RATE_LIMIT_KEY, options);
}

/**
 * Predefined rate limits for common use cases
 */
export const RateLimits = {
  /**
   * Bidding: 5 bids per minute per user per auction
   */
  BIDDING: {
    max: 5,
    windowMs: 60000,
    keyPrefix: 'bidding',
    enableGraduatedCooldown: true,
    message: 'Too many bid attempts. Please wait before trying again.',
  },

  /**
   * Global auction bidding: 20 bids per minute per auction
   */
  GLOBAL_AUCTION_BIDDING: {
    max: 20,
    windowMs: 60000,
    keyPrefix: 'global-auction-bidding',
    enableGraduatedCooldown: true,
    message: 'Too many bids on this auction. Please wait before trying again.',
  },

  /**
   * Retirement: 3 retirements per minute per user
   */
  RETIREMENT: {
    max: 3,
    windowMs: 60000,
    keyPrefix: 'retirement',
    enableGraduatedCooldown: true,
    message: 'Too many retirement requests. Please wait before trying again.',
  },

  /**
   * Company retirement: 10 retirements per minute per company
   */
  COMPANY_RETIREMENT: {
    max: 10,
    windowMs: 60000,
    keyPrefix: 'company-retirement',
    enableGraduatedCooldown: true,
    message: 'Too many company retirements. Please wait before trying again.',
  },

  /**
   * Similar credits: 30 requests per minute per IP
   */
  SIMILAR_CREDITS: {
    max: 30,
    windowMs: 60000,
    keyPrefix: 'similar-credits',
    message:
      'Too many similar credits requests. Please wait before trying again.',
  },

  /**
   * Search: 20 requests per minute per IP
   */
  SEARCH: {
    max: 20,
    windowMs: 60000,
    keyPrefix: 'search',
    message: 'Too many search requests. Please wait before trying again.',
  },

  /**
   * Login: 5 attempts per 15 minutes per IP + email
   */
  LOGIN: {
    max: 5,
    windowMs: 15 * 60 * 1000,
    keyPrefix: 'login',
    enableGraduatedCooldown: true,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },

  /**
   * Register: 3 attempts per hour per IP
   */
  REGISTER: {
    max: 3,
    windowMs: 60 * 60 * 1000,
    keyPrefix: 'register',
    message: 'Too many registration attempts. Please try again after 1 hour.',
  },

  /**
   * Refresh: 10 attempts per hour per IP + user
   */
  REFRESH: {
    max: 10,
    windowMs: 60 * 60 * 1000,
    keyPrefix: 'refresh',
    message: 'Too many refresh attempts. Please try again after 1 hour.',
  },

  /**
   * Forgot Password: 3 attempts per hour per IP + email
   */
  FORGOT_PASSWORD: {
    max: 3,
    windowMs: 60 * 60 * 1000,
    keyPrefix: 'forgot-password',
    enableGraduatedCooldown: true,
    message: 'Too many password reset requests. Please try again after 1 hour.',
  },

  /**
   * Reset Password: 3 attempts per hour per IP + token
   */
  RESET_PASSWORD: {
    max: 3,
    windowMs: 60 * 60 * 1000,
    keyPrefix: 'reset-password',
    message: 'Too many password reset attempts. Please try again after 1 hour.',
  },

  /**
   * Change Password: 5 attempts per hour per user
   */
  CHANGE_PASSWORD: {
    max: 5,
    windowMs: 60 * 60 * 1000,
    keyPrefix: 'change-password',
    message:
      'Too many password change attempts. Please try again after 1 hour.',
  },

  /**
   * Get Profile: 30 requests per minute per user
   */
  ME: {
    max: 30,
    windowMs: 60 * 1000,
    keyPrefix: 'me',
    message: 'Too many profile requests. Please try again later.',
  },

  /**
   * Sessions: 10 requests per minute per user
   */
  SESSIONS: {
    max: 10,
    windowMs: 60 * 1000,
    keyPrefix: 'sessions',
    message: 'Too many session requests. Please try again later.',
  },

  /**
   * Terminate Session: 5 attempts per minute per user
   */
  TERMINATE_SESSION: {
    max: 5,
    windowMs: 60 * 1000,
    keyPrefix: 'terminate-session',
    message: 'Too many session termination attempts. Please try again later.',
  },
};

// ============================================================================
// Auth Rate Limit Decorators (Using RateLimits constants)
// ============================================================================

/**
 * Pre-configured rate limit for login endpoint
 * 5 attempts per 15 minutes
 */
export const LoginRateLimit = () =>
  RateLimit({
    windowMs: RateLimits.LOGIN.windowMs,
    max: RateLimits.LOGIN.max,
    keyPrefix: RateLimits.LOGIN.keyPrefix,
    message: RateLimits.LOGIN.message,
    enableGraduatedCooldown: RateLimits.LOGIN.enableGraduatedCooldown,
  });

/**
 * Pre-configured rate limit for register endpoint
 * 3 attempts per hour
 */
export const RegisterRateLimit = () =>
  RateLimit({
    windowMs: RateLimits.REGISTER.windowMs,
    max: RateLimits.REGISTER.max,
    keyPrefix: RateLimits.REGISTER.keyPrefix,
    message: RateLimits.REGISTER.message,
  });

/**
 * Pre-configured rate limit for refresh endpoint
 * 10 attempts per hour
 */
export const RefreshRateLimit = () =>
  RateLimit({
    windowMs: RateLimits.REFRESH.windowMs,
    max: RateLimits.REFRESH.max,
    keyPrefix: RateLimits.REFRESH.keyPrefix,
    message: RateLimits.REFRESH.message,
  });

/**
 * Pre-configured rate limit for forgot password endpoint
 * 3 attempts per hour
 */
export const ForgotPasswordRateLimit = () =>
  RateLimit({
    windowMs: RateLimits.FORGOT_PASSWORD.windowMs,
    max: RateLimits.FORGOT_PASSWORD.max,
    keyPrefix: RateLimits.FORGOT_PASSWORD.keyPrefix,
    message: RateLimits.FORGOT_PASSWORD.message,
    enableGraduatedCooldown: RateLimits.FORGOT_PASSWORD.enableGraduatedCooldown,
  });

/**
 * Pre-configured rate limit for reset password endpoint
 * 3 attempts per hour
 */
export const ResetPasswordRateLimit = () =>
  RateLimit({
    windowMs: RateLimits.RESET_PASSWORD.windowMs,
    max: RateLimits.RESET_PASSWORD.max,
    keyPrefix: RateLimits.RESET_PASSWORD.keyPrefix,
    message: RateLimits.RESET_PASSWORD.message,
  });

/**
 * Pre-configured rate limit for change password endpoint
 * 5 attempts per hour
 */
export const ChangePasswordRateLimit = () =>
  RateLimit({
    windowMs: RateLimits.CHANGE_PASSWORD.windowMs,
    max: RateLimits.CHANGE_PASSWORD.max,
    keyPrefix: RateLimits.CHANGE_PASSWORD.keyPrefix,
    message: RateLimits.CHANGE_PASSWORD.message,
  });

/**
 * Pre-configured rate limit for profile endpoint
 * 30 requests per minute
 */
export const MeRateLimit = () =>
  RateLimit({
    windowMs: RateLimits.ME.windowMs,
    max: RateLimits.ME.max,
    keyPrefix: RateLimits.ME.keyPrefix,
    message: RateLimits.ME.message,
  });

/**
 * Pre-configured rate limit for sessions endpoint
 * 10 requests per minute
 */
export const SessionsRateLimit = () =>
  RateLimit({
    windowMs: RateLimits.SESSIONS.windowMs,
    max: RateLimits.SESSIONS.max,
    keyPrefix: RateLimits.SESSIONS.keyPrefix,
    message: RateLimits.SESSIONS.message,
  });

/**
 * Pre-configured rate limit for terminate session endpoint
 * 5 attempts per minute
 */
export const TerminateSessionRateLimit = () =>
  RateLimit({
    windowMs: RateLimits.TERMINATE_SESSION.windowMs,
    max: RateLimits.TERMINATE_SESSION.max,
    keyPrefix: RateLimits.TERMINATE_SESSION.keyPrefix,
    message: RateLimits.TERMINATE_SESSION.message,
  });

// ============================================================================
// Rate Limit Config Helpers
// ============================================================================

/**
 * Get rate limit config from endpoint name
 */
export function getRateLimitConfig(
  endpoint: string,
): RateLimitDecoratorOptions | null {
  const configMap: Record<string, RateLimitDecoratorOptions> = {
    login: RateLimits.LOGIN,
    register: RateLimits.REGISTER,
    refresh: RateLimits.REFRESH,
    'forgot-password': RateLimits.FORGOT_PASSWORD,
    'reset-password': RateLimits.RESET_PASSWORD,
    'change-password': RateLimits.CHANGE_PASSWORD,
    me: RateLimits.ME,
    sessions: RateLimits.SESSIONS,
    'terminate-session': RateLimits.TERMINATE_SESSION,
    bidding: RateLimits.BIDDING,
    'global-auction-bidding': RateLimits.GLOBAL_AUCTION_BIDDING,
    retirement: RateLimits.RETIREMENT,
    'company-retirement': RateLimits.COMPANY_RETIREMENT,
    'similar-credits': RateLimits.SIMILAR_CREDITS,
    search: RateLimits.SEARCH,
  };

  return configMap[endpoint] || null;
}

/**
 * Get all rate limit configurations
 */
export function getAllRateLimits(): Record<string, RateLimitDecoratorOptions> {
  return { ...RateLimits };
}
