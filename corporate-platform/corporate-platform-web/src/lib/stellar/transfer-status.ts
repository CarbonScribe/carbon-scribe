import type { StellarTransferState, TransferRecord } from '@/types/stellar'
import { isTerminalTransferState } from '@/types/stellar'

/**
 * Presentation helpers for on-chain transfer confirmation states (FE-069).
 *
 * The transfer table needs to answer three questions a bare status string
 * cannot: how long has this been in flight, is that longer than we'd expect,
 * and is this a transfer we've merely broadcast versus one the network has
 * acknowledged.
 */

/**
 * How long a non-terminal transfer may sit before it is treated as potentially
 * stuck and escalated from amber to red.
 */
export const STUCK_THRESHOLD_MS = readDurationEnv(
  process.env.NEXT_PUBLIC_STELLAR_STUCK_THRESHOLD_MS,
  2 * 60 * 1000,
)

/**
 * A transfer that has been unconfirmed for this long is almost certainly not
 * coming back on its own; the UI says so explicitly rather than just glowing red.
 */
export const SEVERELY_STUCK_THRESHOLD_MS = readDurationEnv(
  process.env.NEXT_PUBLIC_STELLAR_SEVERELY_STUCK_THRESHOLD_MS,
  10 * 60 * 1000,
)

/** How often the transfer status poll runs. */
export const POLL_INTERVAL_MS = readDurationEnv(
  process.env.NEXT_PUBLIC_STELLAR_POLL_INTERVAL_MS,
  8000,
)

/** How often elapsed-time labels re-render while anything is in flight. */
export const ELAPSED_TICK_MS = 1000

function readDurationEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * Best-effort broadcast timestamp for a transfer.
 *
 * `submittedAt` is the field this feature added; records written before the
 * backing column existed fall back to `initiatedAt`, then `createdAt`.
 */
export function resolveSubmittedAt(
  record: Pick<TransferRecord, 'submittedAt' | 'initiatedAt' | 'createdAt'>,
): number | null {
  const candidates = [
    record.submittedAt,
    record.initiatedAt,
    record.createdAt,
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    const parsed = Date.parse(candidate)
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

/**
 * Milliseconds a transfer has been in flight, or `null` when there is no usable
 * timestamp (an older record, or a terminal one where elapsed time is moot).
 */
export function getElapsedMs(
  record: Pick<
    TransferRecord,
    'submittedAt' | 'initiatedAt' | 'createdAt' | 'status'
  >,
  now: number = Date.now(),
): number | null {
  const submittedAt = resolveSubmittedAt(record)
  if (submittedAt === null) return null
  return Math.max(0, now - submittedAt)
}

/**
 * Format a duration as a compact, human-scannable elapsed label:
 * `12s`, `2m 14s`, `1h 03m`.
 */
export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.floor(Math.max(0, elapsedMs) / 1000)

  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes < 60) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  }

  const hours = Math.floor(minutes / 60)
  return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`
}

/** How alarming a non-terminal transfer's age is. */
export type StalenessLevel = 'fresh' | 'stuck' | 'severely-stuck'

export function getStalenessLevel(
  elapsedMs: number | null,
  status: string,
): StalenessLevel {
  // Terminal transfers are never stale — they're done.
  if (isTerminalTransferState(status)) return 'fresh'
  if (elapsedMs === null) return 'fresh'
  if (elapsedMs >= SEVERELY_STUCK_THRESHOLD_MS) return 'severely-stuck'
  if (elapsedMs >= STUCK_THRESHOLD_MS) return 'stuck'
  return 'fresh'
}

/** Everything the status pill needs to render one transfer. */
export interface TransferStatusView {
  status: StellarTransferState
  label: string
  elapsedMs: number | null
  elapsedLabel: string | null
  staleness: StalenessLevel
  isTerminal: boolean
  /** Full sentence used for the tooltip and the accessible label. */
  description: string
}

const STATUS_LABELS: Record<StellarTransferState, string> = {
  SUBMITTED: 'Submitted',
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  FAILED: 'Failed',
}

/** Normalise any backend status string onto the known state union. */
export function normalizeStatus(
  status: string | null | undefined,
): StellarTransferState {
  const upper = String(status ?? '').toUpperCase()
  if (upper in STATUS_LABELS) return upper as StellarTransferState
  // An unrecognised non-terminal value is safest treated as pending: it is
  // in-flight, and the elapsed/stuck treatment still applies.
  return 'PENDING'
}

export function buildStatusView(
  record: Pick<
    TransferRecord,
    'status' | 'submittedAt' | 'initiatedAt' | 'createdAt' | 'errorMessage'
  >,
  now: number = Date.now(),
): TransferStatusView {
  const status = normalizeStatus(record.status)
  const isTerminal = isTerminalTransferState(status)
  const elapsedMs = isTerminal ? null : getElapsedMs(record, now)
  const elapsedLabel = elapsedMs === null ? null : formatElapsed(elapsedMs)
  const staleness = getStalenessLevel(elapsedMs, status)

  return {
    status,
    label: STATUS_LABELS[status],
    elapsedMs,
    elapsedLabel,
    staleness,
    isTerminal,
    description: describe(status, elapsedLabel, staleness, record.errorMessage),
  }
}

function describe(
  status: StellarTransferState,
  elapsedLabel: string | null,
  staleness: StalenessLevel,
  errorMessage?: string | null,
): string {
  if (status === 'CONFIRMED') {
    return 'Confirmed on-chain.'
  }

  if (status === 'FAILED') {
    return errorMessage
      ? `Transfer failed: ${errorMessage}`
      : 'Transfer failed on-chain.'
  }

  const base =
    status === 'SUBMITTED'
      ? 'Broadcast to the network, awaiting on-chain confirmation'
      : 'Observed on-chain, awaiting confirmation'

  const withElapsed = elapsedLabel ? `${base} for ${elapsedLabel}` : base

  if (staleness === 'severely-stuck') {
    return `${withElapsed}. This is well past the expected confirmation window — the transfer is likely stuck.`
  }
  if (staleness === 'stuck') {
    return `${withElapsed}. That is longer than expected; the transfer may be stuck.`
  }
  return `${withElapsed}.`
}
