import { Injectable, Logger } from '@nestjs/common';
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

    // Acquire distributed lock to prevent concurrent processing
    const lockAcquired = await this.acquireLock(lockKey);
    if (!lockAcquired) {
      // Wait for the lock to be released and check again
      await this.waitForLock(lockKey);
      // Recursively check again after lock is released
      return this.processIdempotencyKey(
        normalizedKey,
        companyId,
        userId,
        processor,
        metadata,
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
   * Acquires a distributed lock using Redis
   */
  private async acquireLock(lockKey: string): Promise<boolean> {
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
      return false;
    }
  }

  /**
   * Releases a distributed lock
   */
  private async releaseLock(lockKey: string): Promise<void> {
    const client = this.redisService.getClient();
    try {
      await client.del(lockKey);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to release lock ${lockKey}: ${err.message}`);
    }
  }

  /**
   * Waits for a lock to be released
   */
  private async waitForLock(lockKey: string): Promise<void> {
    const maxWait = 5000; // 5 seconds max wait
    const interval = 100; // 100ms check interval
    let waited = 0;

    while (waited < maxWait) {
      const client = this.redisService.getClient();
      const exists = await client.exists(lockKey);
      if (!exists) {
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
