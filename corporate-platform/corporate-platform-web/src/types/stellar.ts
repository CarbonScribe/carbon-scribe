/**
 * On-chain lifecycle of a Stellar credit transfer (FE-069).
 *
 * `PENDING` alone could not express the difference between a transfer that was
 * broadcast a second ago and one that has been unconfirmed for ten minutes, so
 * both rendered as the same generic yellow pill and users could not tell where
 * a transfer was actually stuck.
 *
 *  SUBMITTED — broadcast to the network, not yet observed as pending on-chain.
 *              Set immediately after the initiating POST resolves and held
 *              until the first status poll returns.
 *  PENDING   — observed on-chain, awaiting confirmation.
 *  CONFIRMED — landed on-chain (terminal).
 *  FAILED    — rejected or exhausted retries (terminal).
 */
export type StellarTransferState =
  | 'SUBMITTED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'FAILED'

/** States from which a transfer can still change. */
export const NON_TERMINAL_TRANSFER_STATES: StellarTransferState[] = [
  'SUBMITTED',
  'PENDING',
]

/** States a transfer never leaves. */
export const TERMINAL_TRANSFER_STATES: StellarTransferState[] = [
  'CONFIRMED',
  'FAILED',
]

export function isTerminalTransferState(
  status: string | null | undefined,
): boolean {
  return TERMINAL_TRANSFER_STATES.includes(status as StellarTransferState)
}

export function isNonTerminalTransferState(
  status: string | null | undefined,
): boolean {
  return !isTerminalTransferState(status)
}

export interface InitiateTransferRequest {
  purchaseId: string
  companyId: string
  projectId: string
  amount: number
  contractId: string
  fromAddress: string
  toAddress: string
}

export interface BatchTransferRequest {
  transfers: InitiateTransferRequest[]
}

export interface TransferRecord {
  id: string
  purchaseId: string
  companyId: string
  projectId: string
  amount: number
  status: StellarTransferState
  transactionHash?: string | null
  errorMessage?: string | null
  /**
   * Moment the transaction was broadcast, used to compute elapsed pending time
   * and the "stuck" threshold.
   *
   * Backend dependency: served by `CreditTransfer.submittedAt`. Older records
   * predate that column, so consumers must fall back to `initiatedAt` /
   * `createdAt` — see `resolveSubmittedAt` in `lib/stellar/transfer-status`.
   */
  submittedAt?: string | null
  /** Legacy/alternative broadcast timestamp emitted by the backend. */
  initiatedAt?: string | null
  confirmedAt?: string | null
  createdAt?: string
  updatedAt?: string
}
