/**
 * Rate-limit helpers shared by the API clients and the countdown UI.
 *
 * The backend guard (`rate-limit.guard.ts`) returns 429 responses with a
 * `Retry-After` header (delta-seconds) plus `X-RateLimit-*` headers. This module
 * is the single place that knows how to turn those values into a client-side
 * wait window and how to decide whether a throttled request is safe to retry.
 */

import { ErrorCode } from './errorParser'
import type { RetryOptions } from './retry'

/** Used when a 429 response carries no usable Retry-After value. */
export const DEFAULT_RATE_LIMIT_RETRY_MS = 60_000

/** Minimal shape shared by `Headers` and test doubles. */
export interface HeaderReader {
  get(name: string): string | null
}

/**
 * Parse an RFC 7231 `Retry-After` value into milliseconds.
 *
 * Accepts delta-seconds (`"120"`), an HTTP-date
 * (`"Wed, 21 Oct 2015 07:28:00 GMT"`) or a numeric seconds value coming from
 * a JSON error body. Returns `undefined` for missing/malformed values.
 */
export function parseRetryAfterMs(
  value: string | number | null | undefined,
  now: number = Date.now(),
): number | undefined {
  if (value === null || value === undefined) return undefined

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return undefined
    return value * 1000
  }

  const trimmed = value.trim()
  if (!trimmed) return undefined

  // delta-seconds: a non-negative integer
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed)
    return Number.isFinite(seconds) ? seconds * 1000 : undefined
  }

  // HTTP-date: measure from the supplied "now" so the caller can freeze time
  // in tests and so a skewed client clock cannot extend the wait window.
  const dateMs = Date.parse(trimmed)
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - now)
  }

  return undefined
}

/**
 * Read the retry window from a response. The `Retry-After` header wins; the
 * JSON error body (which the backend mirrors as `retryAfter` in seconds) is a
 * fallback for proxies that strip headers.
 */
export function getRetryAfterMs(
  headers: HeaderReader | null | undefined,
  body?: unknown,
  now: number = Date.now(),
): number | undefined {
  const fromHeader = parseRetryAfterMs(headers?.get('Retry-After') ?? null, now)
  if (fromHeader !== undefined) return fromHeader

  if (!body || typeof body !== 'object') return undefined
  const obj = body as Record<string, unknown>

  const nested =
    obj.error && typeof obj.error === 'object'
      ? (obj.error as Record<string, unknown>)
      : undefined

  // `retryAfterMs` is already milliseconds (top-level or nested under
  // `error`). `retryAfter` / `retry_after` are delta-seconds or HTTP-dates.
  for (const candidate of [obj.retryAfterMs, nested?.retryAfterMs]) {
    if (
      typeof candidate === 'number' &&
      Number.isFinite(candidate) &&
      candidate >= 0
    ) {
      return candidate
    }
  }

  const retryAfter =
    obj.retryAfter ?? obj.retry_after ?? nested?.retryAfter ?? nested?.retry_after

  return parseRetryAfterMs(retryAfter as string | number | null | undefined, now)
}

/** Paths that must never be auto-retried after a 429 (lockout amplification). */
const AUTH_PATH_TOKENS = [
  '/auth/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/change-password',
  '/refresh',
  '/logout',
  '/sessions',
]

export function isAuthEndpoint(path: string): boolean {
  const normalized = (path || '').toLowerCase()
  return AUTH_PATH_TOKENS.some((token) => normalized.includes(token))
}

export interface RateLimitRetryPolicy {
  /** Whether a 429 response may be retried at all. */
  retry: boolean
  /** Total attempts allowed for a 429 (1 = no retry, 2 = one retry). */
  maxAttempts: number
}

/**
 * Only idempotent, non-auth requests may be retried after a 429, and then
 * exactly once. Replaying a bid/retirement POST after an ambiguous failure
 * risks creating a duplicate, and replaying a login burns more of the limit.
 */
export function getRateLimitRetryPolicy(
  method: string,
  path: string,
): RateLimitRetryPolicy {
  const upperMethod = (method || 'GET').toUpperCase()
  const isIdempotent =
    upperMethod === 'GET' || upperMethod === 'HEAD' || upperMethod === 'OPTIONS'
  const retry = isIdempotent && !isAuthEndpoint(path)

  return { retry, maxAttempts: retry ? 2 : 1 }
}

/** Read a status code from the various error shapes the clients produce. */
export function getErrorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const e = error as Record<string, any>
  return e.status ?? e.statusCode ?? e.parsed?.statusCode ?? e.parsedError?.statusCode
}

/** Read the retry window carried by an error (ApiError, plain Error or ParsedError). */
export function getErrorRetryAfterMs(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const e = error as Record<string, any>
  const candidates: unknown[] = [
    e.retryAfterMs,
    e.parsed?.retryAfterMs,
    e.parsedError?.retryAfterMs,
  ]
  for (const candidate of candidates) {
    if (
      typeof candidate === 'number' &&
      Number.isFinite(candidate) &&
      candidate >= 0
    ) {
      return candidate
    }
  }
  return undefined
}

/** True for any of the error shapes a 429 can take in this app. */
export function isRateLimitError(error: unknown): boolean {
  if (getErrorStatusCode(error) === 429) return true
  if (!error || typeof error !== 'object') return false
  const e = error as Record<string, any>
  const code = e.parsed?.code ?? e.parsedError?.code ?? e.code
  return code === ErrorCode.RATE_LIMITED
}

/**
 * Retry overrides applied by every HTTP client. Keeping this in one place
 * guarantees a POST is never replayed while a GET still gets a single,
 * Retry-After-aware retry.
 */
export function getRateLimitRetryOptions(method: string, path: string) {
  const policy = getRateLimitRetryPolicy(method, path)

  return {
    shouldRetry: (error: unknown, statusCode?: number): boolean => {
      if (statusCode === 429 || isRateLimitError(error)) return policy.retry
      return true
    },
    maxRateLimitAttempts: policy.maxAttempts,
    retryDelayMs: (
      error: unknown,
      statusCode: number | undefined,
      backoffMs: number,
    ): number => {
      if (statusCode === 429 || isRateLimitError(error)) {
        const retryAfterMs = getErrorRetryAfterMs(error)
        if (retryAfterMs !== undefined) return retryAfterMs
      }
      return backoffMs
    },
  }
}

/**
 * Merge a caller's retry config with the rate-limit policy.
 *
 * Rate-limit retries are always active (a single Retry-After-aware retry for
 * safe GETs, none for auth/mutations). Every other failure keeps the previous
 * opt-in behaviour: it is only retried when the caller passed `retry` options.
 */
export function buildRateLimitRetryOptions(
  method: string,
  path: string,
  explicitRetry?: RetryOptions,
): RetryOptions {
  const policy = getRateLimitRetryOptions(method, path)

  return {
    ...(explicitRetry ?? {}),
    maxRateLimitAttempts: policy.maxRateLimitAttempts,
    retryDelayMs: (error, statusCode, backoffMs) => {
      if (explicitRetry?.retryDelayMs) {
        return explicitRetry.retryDelayMs(error, statusCode, backoffMs)
      }
      return policy.retryDelayMs(error, statusCode, backoffMs)
    },
    shouldRetry: (error, statusCode) => {
      if (statusCode === 429 || isRateLimitError(error)) {
        return policy.shouldRetry(error, statusCode)
      }
      if (!explicitRetry) return false
      if (explicitRetry.shouldRetry) return explicitRetry.shouldRetry(error, statusCode)
      return true
    },
  }
}
