import { describe, expect, it } from 'vitest'
import {
  SEVERELY_STUCK_THRESHOLD_MS,
  STUCK_THRESHOLD_MS,
  buildStatusView,
  formatElapsed,
  getElapsedMs,
  getStalenessLevel,
  normalizeStatus,
  resolveSubmittedAt,
} from '@/lib/stellar/transfer-status'

const NOW = Date.parse('2026-08-25T12:00:00.000Z')

function at(offsetMs: number): string {
  return new Date(NOW - offsetMs).toISOString()
}

describe('formatElapsed', () => {
  it('renders sub-minute durations in seconds', () => {
    expect(formatElapsed(0)).toBe('0s')
    expect(formatElapsed(12_400)).toBe('12s')
    expect(formatElapsed(59_999)).toBe('59s')
  })

  it('renders minutes with zero-padded seconds', () => {
    expect(formatElapsed(60_000)).toBe('1m 00s')
    expect(formatElapsed(134_000)).toBe('2m 14s')
  })

  it('renders hours with zero-padded minutes', () => {
    expect(formatElapsed(3 * 3_600_000 + 5 * 60_000)).toBe('3h 05m')
  })

  it('clamps negative input', () => {
    expect(formatElapsed(-5000)).toBe('0s')
  })
})

describe('resolveSubmittedAt', () => {
  it('prefers submittedAt', () => {
    expect(
      resolveSubmittedAt({
        submittedAt: at(1000),
        initiatedAt: at(5000),
        createdAt: at(9000),
      }),
    ).toBe(NOW - 1000)
  })

  it('falls back to initiatedAt then createdAt for records predating submittedAt', () => {
    expect(
      resolveSubmittedAt({ submittedAt: null, initiatedAt: at(5000) }),
    ).toBe(NOW - 5000)
    expect(resolveSubmittedAt({ createdAt: at(9000) })).toBe(NOW - 9000)
  })

  it('returns null when no usable timestamp exists', () => {
    expect(resolveSubmittedAt({})).toBeNull()
    expect(resolveSubmittedAt({ submittedAt: 'not-a-date' })).toBeNull()
  })
})

describe('getElapsedMs', () => {
  it('measures from the broadcast timestamp', () => {
    expect(getElapsedMs({ submittedAt: at(45_000), status: 'PENDING' }, NOW)).toBe(
      45_000,
    )
  })

  it('never returns a negative elapsed time for clock skew', () => {
    expect(
      getElapsedMs({ submittedAt: at(-10_000), status: 'PENDING' }, NOW),
    ).toBe(0)
  })
})

describe('getStalenessLevel', () => {
  it('treats terminal transfers as fresh regardless of age', () => {
    expect(getStalenessLevel(60 * 60_000, 'CONFIRMED')).toBe('fresh')
    expect(getStalenessLevel(60 * 60_000, 'FAILED')).toBe('fresh')
  })

  it('escalates once the stuck threshold is crossed', () => {
    expect(getStalenessLevel(STUCK_THRESHOLD_MS - 1, 'PENDING')).toBe('fresh')
    expect(getStalenessLevel(STUCK_THRESHOLD_MS, 'PENDING')).toBe('stuck')
    expect(getStalenessLevel(SEVERELY_STUCK_THRESHOLD_MS, 'PENDING')).toBe(
      'severely-stuck',
    )
  })

  it('applies to SUBMITTED as well as PENDING', () => {
    expect(getStalenessLevel(STUCK_THRESHOLD_MS, 'SUBMITTED')).toBe('stuck')
  })
})

describe('normalizeStatus', () => {
  it('accepts all four known states, case-insensitively', () => {
    expect(normalizeStatus('submitted')).toBe('SUBMITTED')
    expect(normalizeStatus('PENDING')).toBe('PENDING')
    expect(normalizeStatus('Confirmed')).toBe('CONFIRMED')
    expect(normalizeStatus('FAILED')).toBe('FAILED')
  })

  it('falls back to PENDING for unknown or missing values', () => {
    expect(normalizeStatus('QUEUED')).toBe('PENDING')
    expect(normalizeStatus(undefined)).toBe('PENDING')
  })
})

describe('buildStatusView', () => {
  it('distinguishes just-submitted from pending', () => {
    const submitted = buildStatusView(
      { status: 'SUBMITTED', submittedAt: at(2000) },
      NOW,
    )
    const pending = buildStatusView(
      { status: 'PENDING', submittedAt: at(2000) },
      NOW,
    )

    expect(submitted.label).toBe('Submitted')
    expect(pending.label).toBe('Pending')
    expect(submitted.description).toContain('Broadcast to the network')
    expect(pending.description).toContain('Observed on-chain')
  })

  it('exposes an elapsed label for non-terminal transfers only', () => {
    expect(
      buildStatusView({ status: 'PENDING', submittedAt: at(134_000) }, NOW)
        .elapsedLabel,
    ).toBe('2m 14s')

    expect(
      buildStatusView({ status: 'CONFIRMED', submittedAt: at(134_000) }, NOW)
        .elapsedLabel,
    ).toBeNull()
  })

  it('marks a long-pending transfer as stuck', () => {
    const view = buildStatusView(
      { status: 'PENDING', submittedAt: at(5 * 60_000) },
      NOW,
    )

    expect(view.staleness).toBe('stuck')
    expect(view.isTerminal).toBe(false)
    expect(view.description).toMatch(/may be stuck/i)
  })

  it('surfaces the failure reason on failed transfers', () => {
    const view = buildStatusView(
      { status: 'FAILED', errorMessage: 'insufficient fee' },
      NOW,
    )

    expect(view.isTerminal).toBe(true)
    expect(view.description).toContain('insufficient fee')
  })

  it('degrades gracefully when no timestamp is available', () => {
    const view = buildStatusView({ status: 'PENDING' }, NOW)

    expect(view.elapsedMs).toBeNull()
    expect(view.elapsedLabel).toBeNull()
    expect(view.staleness).toBe('fresh')
    expect(view.label).toBe('Pending')
  })
})
