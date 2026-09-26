import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import {
  IdempotencyOptions,
  ContractCallStatus,
  DuplicateStrategy,
  DeduplicationKeyComponents,
} from '../interfaces/idempotency.interface';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a deduplication key from workflow components
   */
  generateDeduplicationKey(components: DeduplicationKeyComponents): string {
    const data = `${components.workflowId}:${components.methodName}:${components.argsHash}`;
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate an idempotency key if not provided
   */
  generateIdempotencyKey(workflowId: string, methodName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `ik-${workflowId}-${methodName}-${timestamp}-${random}`;
  }

  /**
   * Normalize and hash arguments for deduplication
   */
  hashArguments(args: unknown[]): string {
    const normalized = args.map((arg) => {
      if (typeof arg === 'object' && arg !== null) {
        // Sort object keys for deterministic serialization
        return JSON.stringify(arg, Object.keys(arg).sort());
      }
      return String(arg);
    });
    return createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  /**
   * Check if a contract call is a duplicate and handle accordingly
   */
  async checkAndHandleDuplicate(
    companyId: string,
    contractId: string,
    methodName: string,
    args: unknown[],
    options: IdempotencyOptions,
    strategy: DuplicateStrategy = DuplicateStrategy.RETURN_CACHED,
  ): Promise<{
    isDuplicate: boolean;
    existingCall?: any;
    shouldProceed: boolean;
    deduplicationKey: string;
  }> {
    const argsHash = this.hashArguments(args);
    const deduplicationKey = this.generateDeduplicationKey({
      workflowId: options.workflowId,
      methodName,
      argsHash,
    });

    // Check for existing contract call with same deduplication key
    const existingCall = await this.prisma.contractCall.findUnique({
      where: { deduplicationKey },
    });

    if (existingCall) {
      this.logger.warn(
        `Duplicate contract call detected for workflow ${options.workflowId}, method ${methodName}`,
        { deduplicationKey, existingCallId: existingCall.id },
      );

      // Handle based on strategy
      switch (strategy) {
        case DuplicateStrategy.REJECT:
          throw new ConflictException({
            message: 'Duplicate contract call detected',
            existingCallId: existingCall.id,
            workflowId: options.workflowId,
            deduplicationKey,
          });

        case DuplicateStrategy.RETURN_CACHED:
          // Return the existing result
          return {
            isDuplicate: true,
            existingCall,
            shouldProceed: false,
            deduplicationKey,
          };

        case DuplicateStrategy.ALLOW:
          // Allow execution but mark as duplicate
          return {
            isDuplicate: true,
            existingCall,
            shouldProceed: true,
            deduplicationKey,
          };

        default:
          return {
            isDuplicate: true,
            existingCall,
            shouldProceed: false,
            deduplicationKey,
          };
      }
    }

    return {
      isDuplicate: false,
      shouldProceed: true,
      deduplicationKey,
    };
  }

  /**
   * Create a contract call record with idempotency
   */
  async createContractCall(
    companyId: string,
    contractId: string,
    methodName: string,
    args: unknown[],
    transactionHash: string,
    options: IdempotencyOptions,
    deduplicationKey: string,
  ): Promise<any> {
    const idempotencyKey =
      options.idempotencyKey ||
      this.generateIdempotencyKey(options.workflowId, methodName);

    // Convert args to JSON-safe format
    const argsJson = JSON.parse(JSON.stringify(args)) as Prisma.JsonValue;

    // Convert metadata to JSON-safe format
    const metadataJson = JSON.parse(
      JSON.stringify(options.metadata || {}),
    ) as Prisma.JsonValue;

    return this.prisma.contractCall.create({
      data: {
        companyId,
        contractId,
        methodName,
        args: argsJson,
        transactionHash,
        status: ContractCallStatus.PENDING,
        workflowId: options.workflowId,
        idempotencyKey,
        deduplicationKey,
        isDuplicate: false,
        maxRetries: options.maxRetries || 3,
        retryCount: 0,
        metadata: metadataJson,
        submittedAt: new Date(),
      },
    });
  }

  /**
   * Mark a contract call as confirmed
   */
  async confirmContractCall(callId: string, result: unknown): Promise<any> {
    // Convert result to JSON-safe format
    const resultJson = JSON.parse(JSON.stringify(result)) as Prisma.JsonValue;

    return this.prisma.contractCall.update({
      where: { id: callId },
      data: {
        status: ContractCallStatus.CONFIRMED,
        result: resultJson,
        confirmedAt: new Date(),
      },
    });
  }

  /**
   * Mark a contract call as failed
   */
  async failContractCall(callId: string, errorMessage: string): Promise<any> {
    return this.prisma.contractCall.update({
      where: { id: callId },
      data: {
        status: ContractCallStatus.FAILED,
        errorMessage,
        lastRetryAt: new Date(),
      },
    });
  }

  /**
   * Mark a contract call as a duplicate
   */
  async markDuplicate(
    callId: string,
    originalCallId: string,
    reason: string,
  ): Promise<any> {
    return this.prisma.contractCall.update({
      where: { id: callId },
      data: {
        status: ContractCallStatus.DUPLICATE,
        isDuplicate: true,
        originalCallId,
        duplicateReason: reason,
      },
    });
  }

  /**
   * Get a contract call by workflow ID and method
   */
  async getContractCallByWorkflow(
    companyId: string,
    workflowId: string,
    methodName: string,
  ): Promise<any | null> {
    return this.prisma.contractCall.findFirst({
      where: {
        companyId,
        workflowId,
        methodName,
        isDuplicate: false,
        NOT: {
          status: ContractCallStatus.FAILED,
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });
  }

  /**
   * Get contract call by idempotency key
   */
  async getContractCallByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<any | null> {
    return this.prisma.contractCall.findUnique({
      where: { idempotencyKey },
    });
  }

  /**
   * Check if a workflow has been processed
   */
  async isWorkflowProcessed(
    companyId: string,
    workflowId: string,
    methodName: string,
  ): Promise<boolean> {
    const call = await this.getContractCallByWorkflow(
      companyId,
      workflowId,
      methodName,
    );
    return !!call && call.status === ContractCallStatus.CONFIRMED;
  }

  /**
   * Get all contract calls for a workflow
   */
  async getWorkflowCalls(
    companyId: string,
    workflowId: string,
  ): Promise<any[]> {
    return this.prisma.contractCall.findMany({
      where: {
        companyId,
        workflowId,
      },
      orderBy: {
        submittedAt: 'asc',
      },
    });
  }

  /**
   * Clean up old contract calls (retention)
   */
  async cleanupOldCalls(
    olderThanDays: number = 90,
    statuses: string[] = [
      ContractCallStatus.CONFIRMED,
      ContractCallStatus.DUPLICATE,
    ],
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.contractCall.deleteMany({
      where: {
        status: { in: statuses },
        submittedAt: { lt: cutoffDate },
        isDuplicate: false,
      },
    });

    this.logger.log(`Cleaned up ${result.count} old contract calls`);
    return result.count;
  }
}
