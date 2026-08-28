import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SorobanService } from '../soroban.service';
import { ContractCallStatus } from '../interfaces/idempotency.interface';
import {
  ReconciliationOutcome,
  ReconciliationResult,
  ReconciliationSweepSummary,
  SorobanReconciliationConfig,
  classifyTransactionStatus,
  computeNextRetryAt,
  resolveReconciliationConfig,
} from '../interfaces/reconciliation.interface';

/**
 * SorobanReconciliationService (#515)
 *
 * `SorobanService.invokeContract` checks transaction status exactly once,
 * immediately after `sendTransaction`. If that lookup throws — RPC not yet
 * indexed, timeout, transient node failure — the ContractCall row is written as
 * PENDING and, until this service existed, nothing ever revisited it. A call
 * that landed on-chain seconds later stayed PENDING indefinitely, and the
 * `retryCount` / `maxRetries` / `nextRetryAt` columns the schema already
 * modelled were never read.
 *
 * This sweep closes that gap, mirroring the `nextRetryAt`-driven pattern in
 * `ipfs/services/certificate-dead-letter.service.ts`:
 *
 *  1. Every minute, select PENDING calls whose `nextRetryAt` is null or due.
 *  2. Re-check `getTransaction(transactionHash)` through the Soroban RPC.
 *  3. On SUCCESS/FAILED, write the terminal status, `confirmedAt`, and result.
 *  4. Otherwise increment `retryCount`, set `nextRetryAt` with exponential
 *     backoff, and stop at `maxRetries` by parking the row in the terminal
 *     UNRESOLVED state rather than leaving it PENDING forever.
 *  5. Propagate the outcome to the denormalised `CreditTransfer.status` the
 *     transfer UI polls (FE-069), so a late landing shows up without the user
 *     having to trigger anything.
 *
 * The fix is centralised here: `retirement-tracker.service.ts` and every other
 * consumer of `invokeContract` inherit reconciliation with no code changes.
 *
 * Disable with `SOROBAN_RECONCILIATION_ENABLED=false`.
 */
@Injectable()
export class SorobanReconciliationService {
  private readonly logger = new Logger(SorobanReconciliationService.name);
  private readonly config: SorobanReconciliationConfig =
    resolveReconciliationConfig();
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly soroban: SorobanService,
  ) {}

  /** Scheduled entry point. Guards against overlapping sweeps. */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleReconciliation(): Promise<ReconciliationSweepSummary | null> {
    if (!this.config.enabled) return null;
    if (this.running) {
      this.logger.debug('Reconciliation sweep already in progress; skipping');
      return null;
    }

    this.running = true;
    try {
      return await this.reconcilePending();
    } catch (error) {
      this.logger.error(
        `Soroban reconciliation sweep failed: ${this.errorMessage(error)}`,
      );
      return null;
    } finally {
      this.running = false;
    }
  }

  /**
   * Run one reconciliation sweep. Exposed separately from the cron entry point
   * so an admin endpoint or a test can force an immediate pass.
   */
  async reconcilePending(): Promise<ReconciliationSweepSummary> {
    const startedAt = Date.now();
    const due = await this.findDueForReconciliation();

    const summary: ReconciliationSweepSummary = {
      examined: due.length,
      confirmedLate: 0,
      failed: 0,
      stillPending: 0,
      givenUp: 0,
      checkFailed: 0,
      durationMs: 0,
    };

    if (due.length === 0) {
      summary.durationMs = Date.now() - startedAt;
      return summary;
    }

    this.logger.log(`Reconciling ${due.length} pending contract call(s)`);

    for (const call of due) {
      const result = await this.reconcileOne(call);
      switch (result.outcome) {
        case ReconciliationOutcome.CONFIRMED_LATE:
          summary.confirmedLate += 1;
          break;
        case ReconciliationOutcome.FAILED:
          summary.failed += 1;
          break;
        case ReconciliationOutcome.STILL_PENDING:
          summary.stillPending += 1;
          break;
        case ReconciliationOutcome.GIVEN_UP:
          summary.givenUp += 1;
          break;
        case ReconciliationOutcome.CHECK_FAILED:
          summary.checkFailed += 1;
          break;
      }
    }

    summary.durationMs = Date.now() - startedAt;

    this.logger.log(
      `Soroban reconciliation sweep complete ${JSON.stringify(summary)}`,
    );

    return summary;
  }

  /**
   * Select PENDING contract calls that are due for a re-check.
   *
   * Mirrors the dead-letter query: a null `nextRetryAt` means "never
   * scheduled", which covers rows written by `invokeContract` before this
   * service was wired in.
   */
  async findDueForReconciliation(limit = this.config.batchSize) {
    const prisma = this.prisma as any;
    return prisma.contractCall.findMany({
      where: {
        status: ContractCallStatus.PENDING,
        isDuplicate: false,
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
      },
      orderBy: [{ nextRetryAt: 'asc' }, { submittedAt: 'asc' }],
      take: limit,
    });
  }

  /**
   * Re-check a single contract call and apply the outcome.
   * Exposed for a manual/admin recovery path.
   */
  async reconcileOne(call: {
    id: string;
    transactionHash: string;
    submittedAt?: Date | null;
    retryCount?: number | null;
    maxRetries?: number | null;
  }): Promise<ReconciliationResult> {
    const now = new Date();
    const submittedAt = call.submittedAt ?? now;
    const ageMs = now.getTime() - new Date(submittedAt).getTime();
    const retryCount = (call.retryCount ?? 0) + 1;
    const maxRetries = call.maxRetries ?? this.config.defaultMaxRetries;

    let txDetails: unknown;
    try {
      txDetails = await this.soroban.getTransaction(call.transactionHash);
    } catch (error) {
      const message = this.errorMessage(error);
      await this.rescheduleOrGiveUp(
        call.id,
        retryCount,
        maxRetries,
        now,
        `reconciliation lookup failed: ${message}`,
      );

      const outcome =
        retryCount >= maxRetries
          ? ReconciliationOutcome.GIVEN_UP
          : ReconciliationOutcome.CHECK_FAILED;

      this.logOutcome({
        callId: call.id,
        transactionHash: call.transactionHash,
        outcome,
        retryCount,
        ageMs,
        error: message,
      });

      return {
        callId: call.id,
        transactionHash: call.transactionHash,
        outcome,
        retryCount,
        ageMs,
        error: message,
      };
    }

    const classified = classifyTransactionStatus(txDetails);

    if (classified === 'CONFIRMED') {
      await this.markTerminal(call.id, ContractCallStatus.CONFIRMED, {
        retryCount,
        now,
        result: txDetails,
        confirmedAt: now,
      });
      await this.propagateToTransfer(
        call.transactionHash,
        'CONFIRMED',
        now,
        null,
      );

      const result: ReconciliationResult = {
        callId: call.id,
        transactionHash: call.transactionHash,
        outcome: ReconciliationOutcome.CONFIRMED_LATE,
        retryCount,
        ageMs,
      };
      this.logOutcome(result);
      return result;
    }

    if (classified === 'FAILED') {
      const errorMessage = this.extractRpcError(txDetails);
      await this.markTerminal(call.id, ContractCallStatus.FAILED, {
        retryCount,
        now,
        result: txDetails,
        errorMessage,
      });
      await this.propagateToTransfer(
        call.transactionHash,
        'FAILED',
        null,
        errorMessage,
      );

      const result: ReconciliationResult = {
        callId: call.id,
        transactionHash: call.transactionHash,
        outcome: ReconciliationOutcome.FAILED,
        retryCount,
        ageMs,
        error: errorMessage,
      };
      this.logOutcome(result);
      return result;
    }

    // Still no definitive answer from the RPC.
    await this.rescheduleOrGiveUp(
      call.id,
      retryCount,
      maxRetries,
      now,
      'transaction not yet observed on-chain',
    );

    const outcome =
      retryCount >= maxRetries
        ? ReconciliationOutcome.GIVEN_UP
        : ReconciliationOutcome.STILL_PENDING;

    const result: ReconciliationResult = {
      callId: call.id,
      transactionHash: call.transactionHash,
      outcome,
      retryCount,
      ageMs,
    };
    this.logOutcome(result);
    return result;
  }

  /** Force an immediate re-check of one call by id (admin recovery). */
  async reconcileById(callId: string): Promise<ReconciliationResult> {
    const prisma = this.prisma as any;
    const call = await prisma.contractCall.findUnique({
      where: { id: callId },
    });
    if (!call) {
      throw new NotFoundException(`Contract call ${callId} not found`);
    }
    return this.reconcileOne(call);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async markTerminal(
    callId: string,
    status: ContractCallStatus,
    opts: {
      retryCount: number;
      now: Date;
      result?: unknown;
      confirmedAt?: Date;
      errorMessage?: string;
    },
  ): Promise<void> {
    const prisma = this.prisma as any;
    await prisma.contractCall.update({
      where: { id: callId },
      data: {
        status,
        result: this.toJson(opts.result),
        confirmedAt: opts.confirmedAt ?? undefined,
        errorMessage: opts.errorMessage ?? undefined,
        retryCount: opts.retryCount,
        lastRetryAt: opts.now,
        // Terminal: nothing should pick this row up again.
        nextRetryAt: null,
      },
    });
  }

  /**
   * Increment the retry counter and either schedule the next re-check with
   * exponential backoff, or — once the budget is exhausted — park the row in
   * the terminal UNRESOLVED state so it is no longer indistinguishable from a
   * transaction that is legitimately still in flight.
   */
  private async rescheduleOrGiveUp(
    callId: string,
    retryCount: number,
    maxRetries: number,
    now: Date,
    reason: string,
  ): Promise<void> {
    const prisma = this.prisma as any;
    const exhausted = retryCount >= maxRetries;

    await prisma.contractCall.update({
      where: { id: callId },
      data: {
        retryCount,
        lastRetryAt: now,
        errorMessage: reason,
        ...(exhausted
          ? {
              status: ContractCallStatus.UNRESOLVED,
              nextRetryAt: null,
            }
          : {
              nextRetryAt: computeNextRetryAt(retryCount, this.config, now),
            }),
      },
    });

    if (exhausted) {
      await this.propagateToTransfer(
        undefined,
        'FAILED',
        null,
        `unresolved after ${retryCount} reconciliation attempt(s): ${reason}`,
        callId,
      );
    }
  }

  /**
   * Mirror a reconciled outcome onto the denormalised `CreditTransfer` row the
   * transfer UI polls (FE-069), so a transaction that lands late is reflected
   * without requiring a new user-triggered request.
   *
   * Best-effort: not every contract call corresponds to a credit transfer, and
   * a bookkeeping miss must not fail the reconciliation itself.
   */
  private async propagateToTransfer(
    transactionHash: string | undefined,
    status: 'CONFIRMED' | 'FAILED',
    confirmedAt: Date | null,
    errorMessage: string | null,
    callId?: string,
  ): Promise<void> {
    let hash = transactionHash;

    if (!hash && callId) {
      try {
        const call = await (this.prisma as any).contractCall.findUnique({
          where: { id: callId },
        });
        hash = call?.transactionHash;
      } catch {
        return;
      }
    }

    if (!hash) return;

    try {
      const prisma = this.prisma as any;
      const updated = await prisma.creditTransfer.updateMany({
        where: {
          transactionHash: hash,
          status: { notIn: ['CONFIRMED', 'FAILED'] },
        },
        data: {
          status,
          confirmedAt: confirmedAt ?? undefined,
          errorMessage: errorMessage ?? undefined,
        },
      });

      if (updated?.count) {
        this.logger.log(
          `Reconciliation propagated ${status} to ${updated.count} credit transfer(s) for tx ${hash}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Could not propagate reconciled status to CreditTransfer for tx ${hash}: ${this.errorMessage(error)}`,
      );
    }
  }

  /** Structured, greppable per-row logging for operational visibility. */
  private logOutcome(result: ReconciliationResult): void {
    const payload = JSON.stringify({
      event: 'soroban.reconciliation',
      ...result,
      stale: result.ageMs > this.config.staleAfterMs,
    });

    switch (result.outcome) {
      case ReconciliationOutcome.CONFIRMED_LATE:
        this.logger.log(payload);
        break;
      case ReconciliationOutcome.STILL_PENDING:
        this.logger.debug(payload);
        break;
      case ReconciliationOutcome.GIVEN_UP:
      case ReconciliationOutcome.FAILED:
        this.logger.error(payload);
        break;
      default:
        this.logger.warn(payload);
    }
  }

  private extractRpcError(txDetails: unknown): string {
    const details = txDetails as Record<string, unknown> | null | undefined;
    const candidate =
      details?.resultXdr ?? details?.errorResult ?? details?.status;
    return typeof candidate === 'string'
      ? candidate
      : `transaction reported FAILED by Soroban RPC`;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    try {
      return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
    } catch {
      return null as unknown as Prisma.InputJsonValue;
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
