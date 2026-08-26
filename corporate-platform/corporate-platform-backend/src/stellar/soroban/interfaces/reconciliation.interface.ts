/**
 * Reconciliation of partially-submitted Soroban invocations (#515).
 *
 * `SorobanService.invokeContract` checks transaction status exactly once,
 * immediately after `sendTransaction`. When that lookup throws — the RPC has
 * not indexed the transaction yet, the request times out, the node is briefly
 * unreachable — the ContractCall row is persisted as PENDING and, before this
 * module existed, was never revisited. A transaction that landed on-chain a
 * few seconds later stayed PENDING forever.
 *
 * These types describe the scheduled sweep that re-checks those rows, mirroring
 * the `nextRetryAt`-driven pattern already used by
 * `ipfs/services/certificate-dead-letter.service.ts`.
 *
 * @module stellar/soroban/interfaces/reconciliation
 */

/** Tunable knobs for the reconciliation sweep. */
export interface SorobanReconciliationConfig {
  /** Whether the scheduled sweep runs at all. */
  enabled: boolean;
  /** Maximum ContractCall rows examined per sweep. */
  batchSize: number;
  /** Base delay (ms) used for exponential backoff between re-checks. */
  baseDelayMs: number;
  /** Exponential backoff multiplier. */
  backoffMultiplier: number;
  /** Cap (ms) on the computed backoff delay. */
  maxDelayMs: number;
  /**
   * Fallback retry budget for rows whose `maxRetries` is unset. Rows created by
   * the idempotency service carry their own `maxRetries`.
   */
  defaultMaxRetries: number;
  /** Age (ms) beyond which an unresolved PENDING call is reported as stale. */
  staleAfterMs: number;
}

/** Outcome of re-checking a single PENDING contract call. */
export enum ReconciliationOutcome {
  /** RPC now reports SUCCESS — the call landed on-chain, late. */
  CONFIRMED_LATE = 'confirmed-late',
  /** RPC reports a definitive failure. */
  FAILED = 'failed',
  /** RPC still has no definitive answer; rescheduled with backoff. */
  STILL_PENDING = 'still-pending',
  /** Retry budget exhausted; the row is parked in a terminal UNRESOLVED state. */
  GIVEN_UP = 'given-up',
  /** The re-check itself errored (RPC unreachable); rescheduled with backoff. */
  CHECK_FAILED = 'check-failed',
}

/** Per-row result recorded for operational visibility. */
export interface ReconciliationResult {
  callId: string;
  transactionHash: string;
  outcome: ReconciliationOutcome;
  retryCount: number;
  /** Milliseconds between submission and this reconciliation attempt. */
  ageMs: number;
  error?: string;
}

/** Aggregate counters emitted after each sweep. */
export interface ReconciliationSweepSummary {
  examined: number;
  confirmedLate: number;
  failed: number;
  stillPending: number;
  givenUp: number;
  checkFailed: number;
  durationMs: number;
}

/** Resolve the reconciliation configuration from the environment. */
export function resolveReconciliationConfig(): SorobanReconciliationConfig {
  const num = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  return {
    enabled: process.env.SOROBAN_RECONCILIATION_ENABLED !== 'false',
    batchSize: num(process.env.SOROBAN_RECONCILIATION_BATCH_SIZE, 25),
    baseDelayMs: num(process.env.SOROBAN_RECONCILIATION_BASE_DELAY_MS, 30_000),
    backoffMultiplier: num(
      process.env.SOROBAN_RECONCILIATION_BACKOFF_MULTIPLIER,
      2,
    ),
    maxDelayMs: num(
      process.env.SOROBAN_RECONCILIATION_MAX_DELAY_MS,
      15 * 60_000,
    ),
    defaultMaxRetries: num(process.env.SOROBAN_RECONCILIATION_MAX_RETRIES, 3),
    staleAfterMs: num(
      process.env.SOROBAN_RECONCILIATION_STALE_AFTER_MS,
      30 * 60_000,
    ),
  };
}

/**
 * Compute the next re-check timestamp using capped exponential backoff.
 * `retryCount` is the number of attempts already made.
 */
export function computeNextRetryAt(
  retryCount: number,
  config: SorobanReconciliationConfig,
  from: Date = new Date(),
): Date {
  const delay = Math.min(
    config.baseDelayMs * Math.pow(config.backoffMultiplier, retryCount),
    config.maxDelayMs,
  );
  return new Date(from.getTime() + delay);
}

/**
 * Normalise an RPC `getTransaction` response into a lifecycle decision.
 *
 * Soroban RPC reports `SUCCESS`, `FAILED`, or `NOT_FOUND` (the transaction has
 * not been indexed yet — indistinguishable, from a single lookup, from one that
 * never landed). Only the first two are definitive.
 */
export function classifyTransactionStatus(
  txDetails: unknown,
): 'CONFIRMED' | 'FAILED' | 'PENDING' {
  const raw = String(
    (txDetails as { status?: unknown } | null | undefined)?.status ?? '',
  ).toUpperCase();

  if (raw === 'SUCCESS') return 'CONFIRMED';
  if (raw === 'FAILED' || raw === 'ERROR') return 'FAILED';
  return 'PENDING';
}
