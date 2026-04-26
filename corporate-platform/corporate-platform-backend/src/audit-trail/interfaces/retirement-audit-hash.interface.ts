/**
 * Interfaces for the Retirement Audit Hash Anchoring subsystem.
 *
 * Architectural note:
 *   - Audit hashes (SHA-256 of the full audit record) are stored OFF-CHAIN in the
 *     `RetirementAuditHashAnchor` table.
 *   - Anchoring is proven ON-CHAIN via a Soroban ContractCall whose transaction hash
 *     is stored in `onChainTxHash`. The retirement record itself does NOT contain the
 *     audit hash; the on-chain transaction log serves as the immutable proof of the
 *     anchoring action.
 */

export type AnchorStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

/** Input for anchoring an audit hash to a retirement token. */
export interface AnchorHashInput {
  /** On-chain retirement token ID (u32 in Soroban contract). */
  tokenId: number;
  /** Optional link to an off-chain AuditEvent.id for traceability. */
  auditEventId?: string;
  /**
   * Full audit record to hash. Must be deterministically serializable
   * (all fields will be sorted by key before hashing).
   */
  auditRecord: Record<string, unknown>;
  companyId: string;
  userId: string;
}

/** Result returned after a successful (or attempted) anchor operation. */
export interface AnchorHashResult {
  /** Internal DB anchor record ID. */
  anchorId: string;
  /** On-chain retirement token ID. */
  tokenId: number;
  /** SHA-256 hex digest of the deterministically serialized audit record. */
  auditHash: string;
  /** Soroban transaction hash that proves the anchoring action on-chain. */
  onChainTxHash: string | null;
  /** Whether this result was served from an existing idempotent record. */
  idempotent: boolean;
  anchorStatus: AnchorStatus;
  anchoredAt: string;
}

/** Result returned from a hash verification request. */
export interface VerifyHashResult {
  /** On-chain retirement token ID that was queried. */
  tokenId: number;
  /**
   * The audit hash stored in the off-chain anchor record.
   * Null if no anchor record exists for this tokenId.
   */
  auditHash: string | null;
  /**
   * The on-chain retirement record fetched from the Soroban contract.
   * Contains fields returned by `get_retirement_record`.
   */
  onChainRecord: Record<string, unknown> | null;
  /**
   * True when an off-chain anchor record exists AND the corresponding
   * on-chain ContractCall transaction is confirmed.
   * The audit hash itself is NOT stored on-chain; this flag confirms
   * the anchoring transaction was accepted by the Stellar network.
   */
  txProofConfirmed: boolean;
  /** Soroban transaction hash used as the cryptographic proof. */
  onChainTxHash: string | null;
  anchorStatus: string;
  anchorId: string | null;
  verifiedAt: string;
}
