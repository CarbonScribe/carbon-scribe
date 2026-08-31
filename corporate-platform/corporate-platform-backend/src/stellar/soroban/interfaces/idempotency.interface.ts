/**
 * Idempotency and Deduplication Interfaces for Contract Calls
 *
 * @module stellar/soroban/interfaces/idempotency
 */

/**
 * Idempotency options for a contract call
 */
export interface IdempotencyOptions {
  /** Business workflow ID (e.g., retirement-123, mint-456) */
  workflowId: string;

  /** Client-provided idempotency key (optional, generated if not provided) */
  idempotencyKey?: string;

  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;

  /** Metadata for the call */
  metadata?: Record<string, unknown>;

  /** Whether to skip deduplication check (default: false) */
  skipDeduplication?: boolean;
}

/**
 * Contract call result with idempotency information
 */
export interface IdempotentContractResult<T = unknown> {
  /** The result of the contract call */
  result: T;

  /** The transaction hash */
  transactionHash: string;

  /** Whether this is a new execution or a cached result */
  isCached: boolean;

  /** The contract call record ID */
  callId: string;

  /** The workflow ID associated with this call */
  workflowId: string;

  /** The idempotency key used */
  idempotencyKey: string;

  /**
   * Status of the call.
   *
   * Sourced from {@link ContractCallStatus} rather than restating its members,
   * so adding a status (UNRESOLVED, for the reconciliation sweep) cannot leave
   * this union silently out of date.
   */
  status: ContractCallStatus;

  /** Whether this is a duplicate submission */
  isDuplicate: boolean;

  /** Reference to the original call if this is a duplicate */
  originalCallId?: string;
}

/**
 * Deduplication key components
 */
export interface DeduplicationKeyComponents {
  /** Business workflow ID */
  workflowId: string;

  /** Contract method name */
  methodName: string;

  /** Serialized arguments (normalized) */
  argsHash: string;
}

/**
 * Contract call status enum
 */
export enum ContractCallStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  DUPLICATE = 'DUPLICATE',
  /**
   * Terminal. The reconciliation sweep (#515) exhausted its retry budget
   * without the Soroban RPC ever returning a definitive outcome for this
   * transaction. Distinct from FAILED — the call may have landed on-chain; we
   * simply could not establish that within the retry window, and the row needs
   * an operator to look at it rather than sitting in PENDING forever.
   */
  UNRESOLVED = 'UNRESOLVED',
}

/** Statuses no reconciliation sweep should revisit. */
export const TERMINAL_CONTRACT_CALL_STATUSES: ContractCallStatus[] = [
  ContractCallStatus.CONFIRMED,
  ContractCallStatus.FAILED,
  ContractCallStatus.DUPLICATE,
  ContractCallStatus.UNRESOLVED,
];

/**
 * Duplicate handling strategy
 */
export enum DuplicateStrategy {
  /** Reject the duplicate and return an error */
  REJECT = 'REJECT',

  /** Return the cached result from the original call */
  RETURN_CACHED = 'RETURN_CACHED',

  /** Allow duplicate execution (override) */
  ALLOW = 'ALLOW',
}
