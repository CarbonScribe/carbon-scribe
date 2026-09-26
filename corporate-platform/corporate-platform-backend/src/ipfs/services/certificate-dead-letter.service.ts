import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  CertificateFailureStatus,
  CertificateRetryConfig,
  RecordFailureInput,
  computeNextRetryAt,
  resolveRetryConfig,
} from '../interfaces/certificate-failure.interface';

/** Query filters for listing dead-lettered certificate failures. */
export interface ListFailuresFilter {
  status?: string;
  companyId?: string;
  retirementId?: string;
  limit?: number;
  offset?: number;
}

/**
 * CertificateDeadLetterService (#400)
 *
 * Persists actionable failure state for certificate IPFS anchoring. A failure
 * record captures everything required to retry or repair an anchor without
 * manual database forensics: the original certificate payload, the retirement
 * reference, attempt history, the last error, and the next scheduled retry.
 *
 * Records are de-duplicated per retirement: a recurring failure for the same
 * retirement updates the existing unresolved record instead of creating a new
 * one, so attempt history stays coherent.
 */
@Injectable()
export class CertificateDeadLetterService {
  private readonly logger = new Logger(CertificateDeadLetterService.name);
  private readonly config: CertificateRetryConfig = resolveRetryConfig();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a failed certificate anchoring attempt. If an unresolved record
   * already exists for the retirement, it is updated in place (attempt count is
   * incremented and backoff recomputed); otherwise a new record is created.
   */
  async recordFailure(input: RecordFailureInput) {
    const certificateData = this.toJson(input.certificateData);
    const now = new Date();

    const existing = input.retirementId
      ? await this.prisma.certificateAnchorFailure.findFirst({
          where: {
            retirementId: input.retirementId,
            status: { not: CertificateFailureStatus.RESOLVED },
          },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    if (existing) {
      const attemptCount = existing.attemptCount + 1;
      const record = await this.prisma.certificateAnchorFailure.update({
        where: { id: existing.id },
        data: {
          certificateData,
          companyId: input.companyId ?? existing.companyId,
          attemptCount,
          lastError: input.error,
          lastAttemptAt: now,
          status: this.statusForAttempt(attemptCount),
          nextRetryAt: computeNextRetryAt(attemptCount, this.config, now),
        },
      });
      this.logger.warn(
        `Certificate anchor failure updated (id=${record.id}, retirementId=${input.retirementId}, attempts=${attemptCount})`,
      );
      return record;
    }

    const record = await this.prisma.certificateAnchorFailure.create({
      data: {
        retirementId: input.retirementId ?? null,
        companyId: input.companyId ?? null,
        certificateData,
        attemptCount: 1,
        lastError: input.error,
        lastAttemptAt: now,
        status: this.statusForAttempt(1),
        nextRetryAt: computeNextRetryAt(1, this.config, now),
      },
    });
    this.logger.warn(
      `Certificate anchor failure recorded (id=${record.id}, retirementId=${input.retirementId ?? 'n/a'})`,
    );
    return record;
  }

  /** List failures with optional filtering and pagination. */
  async listFailures(filter: ListFailuresFilter = {}) {
    const where: Record<string, unknown> = {};
    if (filter.status) where.status = filter.status;
    if (filter.companyId) where.companyId = filter.companyId;
    if (filter.retirementId) where.retirementId = filter.retirementId;

    const take = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const skip = Math.max(filter.offset ?? 0, 0);

    const [items, total] = await Promise.all([
      this.prisma.certificateAnchorFailure.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.certificateAnchorFailure.count({ where }),
    ]);

    return { items, total, limit: take, offset: skip };
  }

  /** Fetch a single failure record or throw 404. */
  async getFailure(id: string) {
    const record = await this.prisma.certificateAnchorFailure.findUnique({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException(`Certificate failure ${id} not found`);
    }
    return record;
  }

  /** Claim a record for processing, returning it only if the claim succeeds. */
  async claimForProcessing(id: string) {
    const result = await this.prisma.certificateAnchorFailure.updateMany({
      where: { id, status: { not: CertificateFailureStatus.IN_PROGRESS } },
      data: { status: CertificateFailureStatus.IN_PROGRESS },
    });
    if (result.count === 0) return null;
    return this.prisma.certificateAnchorFailure.findUnique({ where: { id } });
  }

  /** Fetch records that are due for an automatic retry attempt. */
  async findDueForRetry(limit = 25) {
    return this.prisma.certificateAnchorFailure.findMany({
      where: {
        status: CertificateFailureStatus.PENDING,
        attemptCount: { lt: this.config.maxAttempts },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
      },
      orderBy: { nextRetryAt: 'asc' },
      take: limit,
    });
  }

  /** Mark a record as successfully resolved. */
  async markResolved(id: string, cid?: string) {
    const record = await this.prisma.certificateAnchorFailure.update({
      where: { id },
      data: {
        status: CertificateFailureStatus.RESOLVED,
        resolvedCid: cid ?? null,
        resolvedAt: new Date(),
        nextRetryAt: null,
      },
    });
    this.logger.log(
      `Certificate anchor failure resolved (id=${id}${cid ? `, cid=${cid}` : ''})`,
    );
    return record;
  }

  /**
   * Record an unsuccessful retry attempt: increment the attempt count, store the
   * error, and either reschedule (PENDING) or give up (FAILED) based on budget.
   */
  async markRetryFailed(id: string, error: string) {
    const current = await this.getFailure(id);
    const attemptCount = current.attemptCount + 1;
    const now = new Date();
    const status = this.statusForAttempt(attemptCount);

    return this.prisma.certificateAnchorFailure.update({
      where: { id },
      data: {
        attemptCount,
        lastError: error,
        lastAttemptAt: now,
        status,
        nextRetryAt:
          status === CertificateFailureStatus.PENDING
            ? computeNextRetryAt(attemptCount, this.config, now)
            : null,
      },
    });
  }

  /**
   * Manually re-queue a record for retry (admin recovery action). Clears the
   * backoff so the scheduler picks it up on the next tick.
   */
  async requeue(id: string) {
    await this.getFailure(id);
    return this.prisma.certificateAnchorFailure.update({
      where: { id },
      data: {
        status: CertificateFailureStatus.PENDING,
        nextRetryAt: new Date(),
      },
    });
  }

  /** Count unresolved failures (PENDING, IN_PROGRESS, FAILED). */
  async countUnresolved(): Promise<number> {
    return this.prisma.certificateAnchorFailure.count({
      where: { status: { not: CertificateFailureStatus.RESOLVED } },
    });
  }

  /** Stamp the time a threshold alert was emitted, for de-duplication. */
  async markNotified(): Promise<void> {
    await this.prisma.certificateAnchorFailure.updateMany({
      where: { status: { not: CertificateFailureStatus.RESOLVED } },
      data: { notifiedAt: new Date() },
    });
  }

  getConfig(): CertificateRetryConfig {
    return this.config;
  }

  /** A record that has exhausted its budget is FAILED; otherwise PENDING. */
  private statusForAttempt(attemptCount: number): CertificateFailureStatus {
    return attemptCount >= this.config.maxAttempts
      ? CertificateFailureStatus.FAILED
      : CertificateFailureStatus.PENDING;
  }

  /** Coerce arbitrary payloads into a JSON-serialisable value for storage. */
  private toJson(value: unknown): any {
    if (value === null || value === undefined) return {};
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return { unserializable: String(value) };
    }
  }
}
