/**
 * Lifecycle states for a dead-lettered certificate anchoring attempt (#400).
 *
 *  - PENDING     — recorded and awaiting (re)processing by the retry scheduler.
 *  - IN_PROGRESS — currently being reprocessed; prevents concurrent retries.
 *  - FAILED      — exhausted the configured retry budget; needs manual action.
 *  - RESOLVED    — successfully anchored (manually or automatically).
 */
export enum CertificateFailureStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  FAILED = 'failed',
  RESOLVED = 'resolved',
}

/** Statuses that are still eligible for automatic retry. */
export const RETRIABLE_STATUSES: CertificateFailureStatus[] = [
  CertificateFailureStatus.PENDING,
  CertificateFailureStatus.IN_PROGRESS,
];

/** Input used to record a new (or recurring) certificate anchoring failure. */
export interface RecordFailureInput {
  retirementId?: string | null;
  companyId?: string | null;
  certificateData: unknown;
  error: string;
}

/** Tunable knobs for the dead-letter retry scheduler. */
export interface CertificateRetryConfig {
  /** Maximum number of automatic retry attempts before a record is marked FAILED. */
  maxAttempts: number;
  /** Base delay (ms) used for exponential backoff between attempts. */
  baseDelayMs: number;
  /** Exponential backoff multiplier. */
  backoffMultiplier: number;
  /** Cap (ms) on the computed backoff delay. */
  maxDelayMs: number;
  /** Number of unresolved failures that triggers a support notification. */
  alertThreshold: number;
}

/** Resolve the retry configuration from the environment with safe defaults. */
export function resolveRetryConfig(): CertificateRetryConfig {
  const num = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  return {
    maxAttempts: num(process.env.CERT_ANCHOR_RETRY_MAX_ATTEMPTS, 5),
    baseDelayMs: num(process.env.CERT_ANCHOR_RETRY_BASE_DELAY_MS, 60_000),
    backoffMultiplier: num(process.env.CERT_ANCHOR_RETRY_BACKOFF_MULTIPLIER, 2),
    maxDelayMs: num(process.env.CERT_ANCHOR_RETRY_MAX_DELAY_MS, 3_600_000),
    alertThreshold: num(process.env.CERT_ANCHOR_ALERT_THRESHOLD, 10),
  };
}

/**
 * Compute the next retry timestamp using capped exponential backoff.
 * `attemptCount` is the number of attempts already made.
 */
export function computeNextRetryAt(
  attemptCount: number,
  config: CertificateRetryConfig,
  from: Date = new Date(),
): Date {
  const delay = Math.min(
    config.baseDelayMs * Math.pow(config.backoffMultiplier, attemptCount),
    config.maxDelayMs,
  );
  return new Date(from.getTime() + delay);
}
