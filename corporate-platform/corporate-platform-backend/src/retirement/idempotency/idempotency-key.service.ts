import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { RedisService } from '../../cache/redis.service';
import { IdempotencyKeyValidator } from './idempotency-key.validator';
import { ContractCallStatus } from '../../stellar/soroban/interfaces/idempotency.interface';

export interface IdempotencyResult<T = any> {
  isReplay: boolean;
  result?: T;
  status?: string;
  transactionHash?: string;
  callId?: string;
  workflowId?: string;
  idempotencyKey: string;
  existingCall?: any;
}

@Injectable()
export class IdempotencyKeyService {
  private readonly logger = new Logger(IdempotencyKeyService.name);
  private readonly LOCK_TTL = 30000; // 30 seconds lock timeout
  private readonly RETENTION_DAYS = 90;
  // Bounds the lock-wait recursion in processIdempotencyKey (#650):
  // previously an unacquired lock recursed into processIdempotencyKey
  // again with no attempt counter at all, so a lock that never clears —
  // whether held by a crashed process or because Redis itself is
  // unreachable — recursed for the entire life of the request.
  private readonly MAX_LOCK_WAIT_ATTEMPTS = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Processes an idempotency key for a retirement request
   * Returns the cached result if exists, or acquires a lock for processing
   */
  async processIdempotencyKey<T>(
    idempotencyKey: string,
    companyId: string,
    userId: string,
    processor: () => Promise<T>,
    metadata?: Record<string, any>,
    lockWaitAttempt = 0,
  ): Promise<IdempotencyResult<T>> {
    // Validate key format
    const validation = IdempotencyKeyValidator.validate(idempotencyKey);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const normalizedKey = IdempotencyKeyValidator.normalize(idempotencyKey);
    const lockKey = `idempotency:lock:${normalizedKey}`;

    // Check for existing processed call
    const existingCall = await this.findExistingCall(normalizedKey, companyId);

    if (existingCall) {
      // If the call is still pending, return the pending status
      if (existingCall.status === ContractCallStatus.PENDING) {
        this.logger.log(`Idempotency key ${normalizedKey} has pending call`, {
          callId: existingCall.id,
          workflowId: existingCall.workflowId,
        });
        return {
          isReplay: true,
          status: 'PENDING',
          callId: existingCall.id,
          workflowId: existingCall.workflowId,
          idempotencyKey: normalizedKey,
          existingCall,
        };
      }

      // If confirmed, return cached result
      if (existingCall.status === ContractCallStatus.CONFIRMED) {
        this.logger.log(
          `Idempotency key ${normalizedKey} found, returning cached result`,
          {
            callId: existingCall.id,
            workflowId: existingCall.workflowId,
          },
        );
        return {
          isReplay: true,
          result: existingCall.result as T,
          status: existingCall.status,
          transactionHash: existingCall.transactionHash,
          callId: existingCall.id,
          workflowId: existingCall.workflowId,
          idempotencyKey: normalizedKey,
          existingCall,
        };
      }

      // If failed, allow retry but mark as retry
      if (existingCall.status === ContractCallStatus.FAILED) {
        this.logger.log(
          `Idempotency key ${normalizedKey} has failed call, allowing retry`,
          {
            callId: existingCall.id,
            workflowId: existingCall.workflowId,
          },
        );
        // Continue to processing but with retry context
      }
    }

    // Fail closed, not open (#650): this lock exists specifically to
    // prevent a duplicate on-chain retirement submission. Proceeding
    // without it while Redis is down would trade "the request hangs" for
    // "the request silently double-processes a financial transaction" —
    // strictly worse for this particular guard, so an unhealthy Redis
    // rejects the request immediately with a clear 503 instead of ever
    // attempting a lock. A plain cached-result replay (above, for an
    // already-CONFIRMED call) never reaches this check and still works
    // fine with Redis down, since it never needed the lock at all.
    if (!this.redisService.isHealthy()) {
      throw new ServiceUnavailableException(
        'Idempotency guard is temporarily unavailable (Redis unreachable). ' +
          'Retirement submission rejected to avoid processing without duplicate protection.',
      );
    }

    // Acquire distributed lock to prevent concurrent processing
    const lockAcquired = await this.acquireLock(lockKey);
    if (!lockAcquired) {
      if (lockWaitAttempt >= this.MAX_LOCK_WAIT_ATTEMPTS) {
        throw new ServiceUnavailableException(
          `Could not acquire idempotency lock for key ${normalizedKey} after ` +
            `${this.MAX_LOCK_WAIT_ATTEMPTS} attempts. The lock is held by another ` +
            'in-flight request, or Redis degraded mid-request.',
        );
      }
      // Wait for the lock to be released and check again
      await this.waitForLock(lockKey);
      // Recursively check again after lock is released — bounded by
      // MAX_LOCK_WAIT_ATTEMPTS above, not unbounded.
      return this.processIdempotencyKey(
        normalizedKey,
        companyId,
        userId,
        processor,
        metadata,
        lockWaitAttempt + 1,
      );
    }

    try {
      // Double-check if another process completed while waiting
      const recheck = await this.findExistingCall(normalizedKey, companyId);
      if (recheck && recheck.status === ContractCallStatus.CONFIRMED) {
        return {
          isReplay: true,
          result: recheck.result as T,
          status: recheck.status,
          transactionHash: recheck.transactionHash,
          callId: recheck.id,
          workflowId: recheck.workflowId,
          idempotencyKey: normalizedKey,
          existingCall: recheck,
        };
      }

      // Execute the processor
      const result = await processor();

      // Record the successful call
      const call = await this.recordSuccessfulCall(
        normalizedKey,
        companyId,
        userId,
        result,
        metadata,
      );

      return {
        isReplay: false,
        result: result as T,
        status: ContractCallStatus.CONFIRMED,
        transactionHash:
          call.transactionHash || (result as any)?.transactionHash,
        callId: call.id,
        workflowId: call.workflowId || `retirement-${Date.now()}`,
        idempotencyKey: normalizedKey,
      };
    } catch (error) {
      const err = error as Error;
      // Record the failure
      await this.recordFailedCall(normalizedKey, companyId, err.message);
      throw error;
    } finally {
      // Release the lock
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Finds an existing call by idempotency key
   */
  private async findExistingCall(
    idempotencyKey: string,
    companyId: string,
  ): Promise<any | null> {
    return this.prisma.contractCall.findFirst({
      where: {
        idempotencyKey,
        companyId,
        methodName: 'retire',
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });
  }

  /**
   * Acquires a distributed lock using Redis.
   *
   * Checks isHealthy() before issuing the command (#650) and throws
   * rather than returning false when Redis is unavailable — either up
   * front or because the SET command itself failed. This is deliberate:
   * `false` means "lock is legitimately held by someone else, caller
   * should wait and retry"; an unavailable Redis is a completely
   * different situation (the lock's safety guarantee can't be trusted at
   * all) and must never be conflated with a busy lock, which is exactly
   * what caused the unbounded-recursion bug this issue reports — every
   * attempt looked like "busy, try again" instead of "broken, stop".
   */
  private async acquireLock(lockKey: string): Promise<boolean> {
    if (!this.redisService.isHealthy()) {
      throw new ServiceUnavailableException(
        `Cannot acquire idempotency lock ${lockKey}: Redis is unavailable.`,
      );
    }
    const client = this.redisService.getClient();
    try {
      const result = await client.set(
        lockKey,
        'locked',
        'PX',
        this.LOCK_TTL,
        'NX',
      );
      return result === 'OK';
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to acquire lock ${lockKey}: ${err.message}`);
      throw new ServiceUnavailableException(
        `Cannot acquire idempotency lock ${lockKey}: Redis command failed (${err.message}).`,
      );
    }
  }

  /**
   * Releases a distributed lock.
   *
   * Unlike acquireLock, an unavailable Redis here only logs a warning
   * rather than throwing (#650): we already hold a result to return (or
   * an error to propagate) from processIdempotencyKey's try/finally by
   * the time this runs, and the lock's own LOCK_TTL guarantees it expires
   * on its own even if this DEL never reaches Redis. Throwing from a
   * cleanup step would mask whatever the actual operation outcome was.
   */
  private async releaseLock(lockKey: string): Promise<void> {
    if (!this.redisService.isHealthy()) {
      this.logger.warn(
        `Skipping release of lock ${lockKey}: Redis is unavailable. ` +
          `It will expire on its own via its ${this.LOCK_TTL}ms TTL.`,
      );
      return;
    }
    const client = this.redisService.getClient();
    try {
      await client.del(lockKey);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to release lock ${lockKey}: ${err.message}`);
    }
  }

  /**
   * Waits for a lock to be released. Returns early — rather than spinning
   * for the full maxWait — the moment Redis looks unhealthy or the EXISTS
   * command itself fails (#650), since neither situation will resolve by
   * continuing to poll; the caller's bounded lockWaitAttempt counter (see
   * processIdempotencyKey) takes it from there.
   */
  private async waitForLock(lockKey: string): Promise<void> {
    const maxWait = 5000; // 5 seconds max wait
    const interval = 100; // 100ms check interval
    let waited = 0;

    while (waited < maxWait) {
      if (!this.redisService.isHealthy()) {
        this.logger.warn(
          `Redis became unavailable while waiting for lock ${lockKey}`,
        );
        return;
      }
      const client = this.redisService.getClient();
      try {
        const exists = await client.exists(lockKey);
        if (!exists) {
          return;
        }
      } catch (error) {
        const err = error as Error;
        this.logger.warn(
          `Error checking lock ${lockKey} while waiting: ${err.message}`,
        );
        return;
      }
      await this.sleep(interval);
      waited += interval;
    }

    this.logger.warn(`Lock wait timeout for ${lockKey}`);
  }

  /**
   * Records a successful contract call
   */
  private async recordSuccessfulCall(
    idempotencyKey: string,
    companyId: string,
    userId: string,
    result: any,
    metadata?: Record<string, any>,
  ): Promise<any> {
    const workflowId = `retirement-${idempotencyKey}-${Date.now()}`;
    const transactionHash = result?.transactionHash || `tx-${Date.now()}`;

    return this.prisma.contractCall.create({
      data: {
        companyId,
        contractId: process.env.RETIREMENT_TRACKER_CONTRACT_ID || '',
        methodName: 'retire',
        transactionHash,
        args: {
          creditId: result?.creditId || metadata?.creditId,
          amount: result?.amount || metadata?.amount,
        } as any,
        status: ContractCallStatus.CONFIRMED,
        result: result as any,
        workflowId,
        idempotencyKey,
        deduplicationKey: `ik-${idempotencyKey}`,
        isDuplicate: false,
        maxRetries: 3,
        retryCount: 0,
        metadata: (metadata as any) || {},
        submittedAt: new Date(),
        confirmedAt: new Date(),
      },
    });
  }

  /**
   * Records a failed contract call
   */
  private async recordFailedCall(
    idempotencyKey: string,
    companyId: string,
    errorMessage: string,
  ): Promise<void> {
    const existing = await this.findExistingCall(idempotencyKey, companyId);

    if (existing) {
      await this.prisma.contractCall.update({
        where: { id: existing.id },
        data: {
          status: ContractCallStatus.FAILED,
          errorMessage,
          lastRetryAt: new Date(),
          retryCount: { increment: 1 },
        },
      });
    } else {
      await this.prisma.contractCall.create({
        data: {
          companyId,
          contractId: process.env.RETIREMENT_TRACKER_CONTRACT_ID || '',
          methodName: 'retire',
          transactionHash: `failed-${Date.now()}`,
          args: {} as any,
          status: ContractCallStatus.FAILED,
          workflowId: `retirement-${idempotencyKey}`,
          idempotencyKey,
          deduplicationKey: `ik-${idempotencyKey}`,
          isDuplicate: false,
          maxRetries: 3,
          retryCount: 1,
          errorMessage,
          submittedAt: new Date(),
        },
      });
    }
  }

  /**
   * Cleans up expired idempotency records
   */
  async cleanupExpiredRecords(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

    const result = await this.prisma.contractCall.deleteMany({
      where: {
        status: {
          in: [ContractCallStatus.CONFIRMED, ContractCallStatus.DUPLICATE],
        },
        submittedAt: { lt: cutoffDate },
        isDuplicate: false,
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired idempotency records`);
    return result.count;
  }

  /**
   * Gets idempotency metrics
   */
  async getMetrics(idempotencyKey: string): Promise<{
    totalCalls: number;
    confirmedCalls: number;
    failedCalls: number;
    pendingCalls: number;
  }> {
    const calls = await this.prisma.contractCall.findMany({
      where: { idempotencyKey },
    });

    return {
      totalCalls: calls.length,
      confirmedCalls: calls.filter(
        (c) => c.status === ContractCallStatus.CONFIRMED,
      ).length,
      failedCalls: calls.filter((c) => c.status === ContractCallStatus.FAILED)
        .length,
      pendingCalls: calls.filter((c) => c.status === ContractCallStatus.PENDING)
        .length,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
