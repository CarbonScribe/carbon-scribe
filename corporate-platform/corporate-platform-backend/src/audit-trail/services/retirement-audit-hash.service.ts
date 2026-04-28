import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../shared/database/prisma.service';
import { RetirementTrackerService } from '../../stellar/soroban/contracts/retirement-tracker.service';
import { EventLoggerService } from './event-logger.service';
import {
  AuditAction,
  AuditEventType,
} from '../interfaces/audit-event.interface';
import {
  AnchorHashInput,
  AnchorHashResult,
  AnchorStatus,
  VerifyHashResult,
} from '../interfaces/retirement-audit-hash.interface';
import { RETIREMENT_TRACKER_CONTRACT_ID } from '../../stellar/soroban/contracts/contract.interface';

/**
 * RetirementAuditHashService
 *
 * Anchors SHA-256 audit hashes to the Soroban RetirementTracker contract and
 * provides verification against the resulting on-chain transaction proof.
 *
 * Architecture summary:
 *   1. The full audit record is serialized deterministically (recursive sorted-key
 *      JSON) and hashed with SHA-256 to produce the `auditHash`.
 *   2. The hash is stored off-chain in `RetirementAuditHashAnchor` with status PENDING.
 *   3. The Soroban contract is invoked (`anchor_audit_hash`) in production mode when
 *      STELLAR_SECRET_KEY is set, producing an on-chain transaction hash as proof.
 *      In development/simulation mode the ContractCall record still serves as an
 *      auditable record of the anchoring action.
 *   4. The anchor record is updated with the on-chain tx hash and final status.
 *   5. A companion AuditEvent is recorded for full traceability of the anchoring
 *      action itself.
 *
 * Idempotency:
 *   Duplicate anchor requests for the same (tokenId, auditHash) pair are detected
 *   via the DB unique constraint and return the existing record instead of
 *   re-invoking the contract.
 *
 * Partial-failure recovery:
 *   If the DB write succeeds but the Soroban invocation fails, the anchor record
 *   is updated to status FAILED with the error captured in `metadata`. The caller
 *   may retry and the idempotency check allows a fresh invocation for FAILED records.
 */
@Injectable()
export class RetirementAuditHashService {
  private readonly logger = new Logger(RetirementAuditHashService.name);

  private readonly contractId =
    process.env.RETIREMENT_TRACKER_CONTRACT_ID ||
    process.env.STELLAR_RETIREMENT_TRACKER_CONTRACT_ID ||
    RETIREMENT_TRACKER_CONTRACT_ID;

  constructor(
    private readonly prisma: PrismaService,
    private readonly retirementTracker: RetirementTrackerService,
    private readonly eventLogger: EventLoggerService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate a SHA-256 audit hash and anchor it to the RetirementTracker contract.
   *
   * Returns an existing anchor record (idempotent) when a matching
   * (tokenId, auditHash) pair already exists with status CONFIRMED.
   * For FAILED records a fresh on-chain invocation is attempted.
   */
  async anchorHash(input: AnchorHashInput): Promise<AnchorHashResult> {
    const auditHash = this.computeAuditHash(input.auditRecord);

    // ── Idempotency check ────────────────────────────────────────────────
    const existing = await this.prisma.retirementAuditHashAnchor.findUnique({
      where: { tokenId_auditHash: { tokenId: input.tokenId, auditHash } },
    });

    if (existing && existing.anchorStatus === 'CONFIRMED') {
      this.logger.log(
        `Idempotent hit: tokenId=${input.tokenId} hash=${auditHash.slice(0, 12)}…`,
      );
      return this.toAnchorResult(existing, true);
    }

    // ── Create or reuse a PENDING/FAILED DB record ───────────────────────
    let anchor: Awaited<
      ReturnType<typeof this.prisma.retirementAuditHashAnchor.create>
    >;

    if (existing) {
      // FAILED record — reset to PENDING for retry
      anchor = await this.prisma.retirementAuditHashAnchor.update({
        where: { id: existing.id },
        data: {
          anchorStatus: 'PENDING',
          onChainTxHash: null,
          metadata: null,
        },
      });
    } else {
      anchor = await this.prisma.retirementAuditHashAnchor.create({
        data: {
          companyId: input.companyId,
          tokenId: input.tokenId,
          auditEventId: input.auditEventId ?? null,
          auditHash,
          contractId: this.contractId,
          anchorStatus: 'PENDING',
        },
      });
    }

    // ── On-chain invocation ──────────────────────────────────────────────
    let onChainTxHash: string | null = null;
    let finalStatus: AnchorStatus = 'PENDING';

    try {
      const result = await this.retirementTracker.invoke({
        companyId: input.companyId,
        methodName: 'anchor_audit_hash',
        args: [
          { type: 'u32', value: input.tokenId },
          { type: 'string', value: auditHash },
        ],
      });

      onChainTxHash = result.transactionHash ?? null;
      finalStatus = result.status === 'CONFIRMED' ? 'CONFIRMED' : 'PENDING';

      this.logger.log(
        `Anchored hash for tokenId=${input.tokenId}: txHash=${onChainTxHash}, status=${finalStatus}`,
      );
    } catch (err) {
      // ── Partial-failure handling ─────────────────────────────────────
      // DB record exists; mark FAILED with error detail so callers / jobs
      // can retry or escalate without losing the pending anchor record.
      const errMsg = this.extractMessage(err);
      this.logger.error(
        `On-chain anchor failed for tokenId=${input.tokenId}: ${errMsg}`,
      );
      await this.prisma.retirementAuditHashAnchor.update({
        where: { id: anchor.id },
        data: {
          anchorStatus: 'FAILED',
          metadata: { error: errMsg, failedAt: new Date().toISOString() },
        },
      });

      // Still log an audit event so the failed attempt is traceable.
      await this.recordAuditEvent(input, auditHash, null, 'FAILED');

      return this.toAnchorResult(
        { ...anchor, anchorStatus: 'FAILED', onChainTxHash: null },
        false,
      );
    }

    // ── Persist the on-chain result ──────────────────────────────────────
    const updated = await this.prisma.retirementAuditHashAnchor.update({
      where: { id: anchor.id },
      data: { onChainTxHash, anchorStatus: finalStatus },
    });

    // ── Companion audit event ────────────────────────────────────────────
    await this.recordAuditEvent(input, auditHash, onChainTxHash, finalStatus);

    return this.toAnchorResult(updated, false);
  }

  /**
   * Verify the audit hash anchor for a given on-chain token ID.
   *
   * Returns the off-chain anchor record and the current on-chain retirement
   * record. `txProofConfirmed` is true when the stored anchor exists and
   * its Soroban transaction is confirmed — this is the cryptographic proof
   * that the anchoring action was accepted on-chain.
   *
   * Note: the audit hash itself is NOT stored on-chain; the Soroban contract
   * is queried for the retirement record to confirm the token exists, while
   * the transaction hash in the anchor record constitutes the immutable proof.
   */
  async verifyHash(
    companyId: string,
    tokenId: number,
  ): Promise<VerifyHashResult> {
    const anchor = await this.prisma.retirementAuditHashAnchor.findFirst({
      where: { companyId, tokenId },
      orderBy: { anchoredAt: 'desc' },
    });

    if (!anchor) {
      throw new NotFoundException(
        `No audit hash anchor found for tokenId=${tokenId} in company ${companyId}`,
      );
    }

    // Fetch the on-chain retirement record to prove the token exists.
    let onChainRecord: Record<string, unknown> | null = null;
    try {
      onChainRecord = await this.retirementTracker.getRetirementRecord(
        anchor.onChainTxHash ?? String(tokenId),
      );
    } catch (err) {
      this.logger.warn(
        `Could not retrieve on-chain record for tokenId=${tokenId}: ${this.extractMessage(err)}`,
      );
    }

    const verifiedAt = new Date();
    await this.prisma.retirementAuditHashAnchor.update({
      where: { id: anchor.id },
      data: { verifiedAt },
    });

    const txProofConfirmed =
      anchor.anchorStatus === 'CONFIRMED' && anchor.onChainTxHash !== null;

    return {
      tokenId,
      auditHash: anchor.auditHash,
      onChainRecord,
      txProofConfirmed,
      onChainTxHash: anchor.onChainTxHash,
      anchorStatus: anchor.anchorStatus,
      anchorId: anchor.id,
      verifiedAt: verifiedAt.toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Hashing — deterministic serialization
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute SHA-256 of the audit record using a stable, deterministic
   * serialization strategy: keys are sorted recursively at every nesting
   * level before JSON encoding to eliminate insertion-order variance.
   */
  computeAuditHash(record: Record<string, unknown>): string {
    const canonical = this.stableSerialize(record);
    return createHash('sha256').update(canonical).digest('hex');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Recursively serialize a value into a deterministic string.
   * Objects have their keys sorted; arrays preserve order (order is semantic
   * in arrays).
   */
  private stableSerialize(value: unknown): string {
    if (value === null || value === undefined) {
      return JSON.stringify(null);
    }

    if (value instanceof Date) {
      return JSON.stringify(value.toISOString());
    }

    if (Array.isArray(value)) {
      const items = value.map((v) => this.stableSerialize(v)).join(',');
      return `[${items}]`;
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const sorted = Object.keys(obj)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${this.stableSerialize(obj[k])}`)
        .join(',');
      return `{${sorted}}`;
    }

    return JSON.stringify(value);
  }

  private toAnchorResult(
    anchor: {
      id: string;
      tokenId: number;
      auditHash: string;
      onChainTxHash?: string | null;
      anchorStatus: string;
      anchoredAt: Date;
    },
    idempotent: boolean,
  ): AnchorHashResult {
    return {
      anchorId: anchor.id,
      tokenId: anchor.tokenId,
      auditHash: anchor.auditHash,
      onChainTxHash: anchor.onChainTxHash ?? null,
      idempotent,
      anchorStatus: anchor.anchorStatus as AnchorStatus,
      anchoredAt: anchor.anchoredAt.toISOString(),
    };
  }

  private async recordAuditEvent(
    input: AnchorHashInput,
    auditHash: string,
    txHash: string | null,
    status: string,
  ) {
    try {
      await this.eventLogger.recordEvent({
        companyId: input.companyId,
        userId: input.userId,
        eventType: AuditEventType.RETIREMENT,
        action: AuditAction.CREATE,
        entityType: 'RetirementAuditHashAnchor',
        entityId: String(input.tokenId),
        newState: { auditHash, onChainTxHash: txHash, anchorStatus: status },
        metadata: {
          tokenId: input.tokenId,
          contractId: this.contractId,
          auditEventId: input.auditEventId,
        },
      });
    } catch (err) {
      // Log failure but do not propagate — audit-of-audit should never block anchoring.
      this.logger.warn(
        `Companion audit event failed: ${this.extractMessage(err)}`,
      );
    }
  }

  private extractMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
}
