import { describe, it, expect } from 'vitest'
import {
  parseRetryAfterMs,
  getRetryAfterMs,
  getRateLimitRetryPolicy,
  isAuthEndpoint,
} from './rateLimit'

describe('rateLimit', () => {
  describe('parseRetryAfterMs', () => {
    it('parses delta-seconds', () => {
      expect(parseRetryAfterMs('120', 1000)).toBe(120_000)
      expect(parseRetryAfterMs('0', 1000)).toBe(0)
    })

    it('parses an HTTP-date relative to the supplied now', () => {
      const now = Date.parse('Wed, 21 Oct 2015 07:28:00 GMT')
      expect(parseRetryAfterMs('Wed, 21 Oct 2015 07:28:30 GMT', now)).toBe(30_000)
    })

    it('clamps an HTTP-date in the past to zero', () => {
      const now = Date.parse('Wed, 21 Oct 2015 07:28:00 GMT')
      expect(parseRetryAfterMs('Wed, 21 Oct 2015 07:27:00 GMT', now)).toBe(0)
    })

    it('ignores missing or malformed values', () => {
      expect(parseRetryAfterMs(null)).toBeUndefined()
      expect(parseRetryAfterMs(undefined)).toBeUndefined()
      expect(parseRetryAfterMs('')).toBeUndefined()
      expect(parseRetryAfterMs('not-a-date')).toBeUndefined()
    })
  })

  describe('getRetryAfterMs', () => {
    const headerReader = (value: string | null) => ({
      get: (name: string) =>
        name.toLowerCase() === 'retry-after' ? value : null,
    })

    it('prefers the Retry-After header over the JSON body', () => {
      expect(getRetryAfterMs(headerReader('12'), { retryAfter: 99 }, 0)).toBe(
        12_000,
      )
    })

    it('falls back to retryAfter (seconds) in the error body', () => {
      expect(getRetryAfterMs(undefined, { retryAfter: 7 }, 0)).toBe(7_000)
    })

    it('reads retryAfterMs (milliseconds) from a nested error body', () => {
      expect(getRetryAfterMs(null, { error: { retryAfterMs: 4500 } }, 0)).toBe(
        4500,
      )
    })
  })

  describe('getRateLimitRetryPolicy', () => {
    it('allows exactly one retry for idempotent, non-auth GETs', () => {
      expect(getRateLimitRetryPolicy('GET', '/api/v1/auctions')).toEqual({
        retry: true,
        maxAttempts: 2,
      })
    })

    it('never retries mutations such as bids or retirements', () => {
      expect(
        getRateLimitRetryPolicy('POST', '/api/v1/auctions/1/bids'),
      ).toEqual({ retry: false, maxAttempts: 1 })
    })

    it('never retries auth endpoints', () => {
      expect(isAuthEndpoint('/api/v1/auth/login')).toBe(true)
      expect(getRateLimitRetryPolicy('POST', '/api/v1/auth/login')).toEqual({
        retry: false,
        maxAttempts: 1,
      })
    })
  })
})
