import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRateLimitCountdown } from './useRateLimitCountdown'
import { ApiError } from '@/lib/api/http'
import { ErrorCode } from '@/lib/utils/errorParser'

describe('useRateLimitCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is inert for ordinary errors', () => {
    const { result } = renderHook(() => useRateLimitCountdown(new Error('nope')))

    expect(result.current.isRateLimited).toBe(false)
    expect(result.current.isBlocked).toBe(false)
    expect(result.current.message).toBe('')
  })

  it('shows a countdown and blocks until Retry-After elapses', () => {
    const error = new ApiError(429, 'Too many attempts', null, 3000)
    const { result } = renderHook(() => useRateLimitCountdown(error))

    expect(result.current.isRateLimited).toBe(true)
    expect(result.current.totalSeconds).toBe(3)
    expect(result.current.secondsRemaining).toBe(3)
    expect(result.current.message).toBe('Too many attempts — try again in 3s')
    expect(result.current.isBlocked).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.secondsRemaining).toBe(2)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.isBlocked).toBe(false)
    expect(result.current.message).toMatch(/try again now/i)
  })

  it('understands parsed error objects attached to ApiResponse', () => {
    const error = {
      code: ErrorCode.RATE_LIMITED,
      statusCode: 429,
      message: 'slow down',
      retryAfterMs: 1000,
    }
    const { result } = renderHook(() => useRateLimitCountdown(error))

    expect(result.current.isRateLimited).toBe(true)
    expect(result.current.totalSeconds).toBe(1)
    expect(result.current.isBlocked).toBe(true)
  })
})
