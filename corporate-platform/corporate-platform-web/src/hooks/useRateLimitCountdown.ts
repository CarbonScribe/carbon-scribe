'use client'

import { useEffect, useState } from 'react'
import { ErrorCode } from '@/lib/utils/errorParser'
import {
  DEFAULT_RATE_LIMIT_RETRY_MS,
  getErrorRetryAfterMs,
  getErrorStatusCode,
} from '@/lib/utils/rateLimit'

export interface RateLimitCountdown {
  /** True when the supplied error represents a throttling response. */
  isRateLimited: boolean
  /** Whole seconds left before the user may retry (ceil). */
  secondsRemaining: number
  /** Length of the wait window, in seconds. */
  totalSeconds: number
  /** True while form submission must be blocked. */
  isBlocked: boolean
  /** Ready-to-render message, e.g. "Too many attempts — try again in 9s". */
  message: string
  /** The wait window in milliseconds (defaults when Retry-After is absent). */
  retryAfterMs?: number
}

function readIsRateLimited(error: unknown): boolean {
  if (getErrorStatusCode(error) === 429) return true
  if (!error || typeof error !== 'object') return false
  const e = error as Record<string, any>
  const code = e.parsed?.code ?? e.parsedError?.code ?? e.code
  return code === ErrorCode.RATE_LIMITED
}

/**
 * Turns a rate-limit error into a live countdown. Accepts every error shape
 * the API clients produce: `ApiError`, plain errors with `status`, and parsed
 * error objects attached to an `ApiResponse`.
 *
 * Non-rate-limit errors return an inert result, so forms can call this hook
 * unconditionally.
 */
export function useRateLimitCountdown(error: unknown): RateLimitCountdown {
  const isRateLimited = readIsRateLimited(error)
  const retryAfterMs = isRateLimited
    ? getErrorRetryAfterMs(error) ?? DEFAULT_RATE_LIMIT_RETRY_MS
    : undefined

  const [deadline, setDeadline] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // Start the window when the error is observed rather than when the request
  // was made, so slow renders don't eat into the user's wait time.
  useEffect(() => {
    if (!isRateLimited || retryAfterMs === undefined) {
      setDeadline(null)
      return
    }
    const startedAt = Date.now()
    setDeadline(startedAt + retryAfterMs)
    setNow(startedAt)
  }, [isRateLimited, retryAfterMs])

  useEffect(() => {
    if (deadline === null) return
    const tick = () => setNow(Date.now())
    const interval = setInterval(tick, 500)
    return () => clearInterval(interval)
  }, [deadline])

  const remainingMs = deadline === null ? 0 : Math.max(0, deadline - now)
  const secondsRemaining = Math.ceil(remainingMs / 1000)
  const totalSeconds = retryAfterMs === undefined ? 0 : Math.ceil(retryAfterMs / 1000)
  const isBlocked = isRateLimited && secondsRemaining > 0

  const message = !isRateLimited
    ? ''
    : isBlocked
      ? `Too many attempts — try again in ${secondsRemaining}s`
      : 'Too many attempts — you can try again now.'

  return {
    isRateLimited,
    secondsRemaining,
    totalSeconds,
    isBlocked,
    message,
    retryAfterMs,
  }
}

export default useRateLimitCountdown
