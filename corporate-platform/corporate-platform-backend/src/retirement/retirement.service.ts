import { Injectable, Logger } from '@nestjs/common';
import { CarbonAssetService } from '../stellar/soroban/contracts/carbon-asset.service';
import { IdempotencyService } from '../stellar/soroban/idempotency/idempotency.service';
import { DuplicateStrategy } from '../stellar/soroban/interfaces/idempotency.interface';
import { IdempotencyKeyService } from './idempotency/idempotency-key.service';
import { InvalidRetirementAmountError } from '../shared/exceptions/error-classes';

export interface RetirementResult {
  success: boolean;
  cached: boolean;
  isDuplicate?: boolean;
  transactionHash?: string;
  result?: unknown;
  workflowId: string;
  callId?: string;
  originalCallId?: string;
  idempotencyKey?: string;
}

export interface RetirementStatusResult {
  found: boolean;
  status: string;
  transactionHash?: string;
  result?: unknown;
  submittedAt?: Date;
  confirmedAt?: Date | null;
  isDuplicate?: boolean;
  workflowId: string;
}

@Injectable()
export class RetirementService {
  private readonly logger = new Logger(RetirementService.name);

  constructor(
    private readonly carbonAssetService: CarbonAssetService,
    private readonly idempotencyService: IdempotencyService,
    private readonly idempotencyKeyService: IdempotencyKeyService,
  ) {}

  /**
   * Retire credits with idempotency support
   *
   * @param companyId - The company ID for the retirement
   * @param userId - The user ID performing the retirement
   * @param creditId - The credit ID to retire
   * @param amount - The amount of credits to retire
   * @param purpose - The purpose of the retirement
   * @param idempotencyKey - Optional client-provided idempotency key
   * @returns Retirement result with idempotency information
   * @throws {CreditNotFoundError} if credit not found
   * @throws {InsufficientCreditsError} if insufficient credits available
   * @throws {InvalidRetirementAmountError} if amount is invalid
   */
  async retireCredits(
    companyId: string,
    userId: string,
    creditId: string,
    amount: number,
    purpose: string,
    idempotencyKey?: string,
  ): Promise<RetirementResult> {
    // Validate amount
    if (amount <= 0) {
      throw new InvalidRetirementAmountError(amount, 1);
    }

    // Use client-provided key if available, otherwise generate one
    const workflowId = idempotencyKey
      ? `retirement-${idempotencyKey}`
      : `retirement-${creditId}-${Date.now()}`;

    this.logger.log(`Processing retirement for workflow ${workflowId}`, {
      companyId,
      userId,
      creditId,
      amount,
      purpose,
      idempotencyKey,
    });

    // Check if already processed (using the client-provided key if available)
    const lookupKey = idempotencyKey || workflowId;
    const isProcessed = await this.idempotencyService.isWorkflowProcessed(
      companyId,
      lookupKey,
      'retire',
    );

    if (isProcessed) {
      // Return cached result
      const call = await this.idempotencyService.getContractCallByWorkflow(
        companyId,
        lookupKey,
        'retire',
      );

      if (!call) {
        throw new Error('Cached call not found despite being processed');
      }

      this.logger.log(`Returning cached result for workflow ${workflowId}`, {
        idempotencyKey,
        cached: true,
      });

      return {
        success: true,
        cached: true,
        transactionHash: call.transactionHash,
        result: call.result,
        workflowId,
        callId: call.id,
        idempotencyKey,
      };
    }

    try {
      // Execute with idempotency
      const result = await this.carbonAssetService.invokeWithIdempotency(
        companyId,
        {
          companyId,
          methodName: 'retire',
          args: [
            { type: 'u32', value: parseInt(creditId, 10) },
            { type: 'u32', value: amount },
          ],
        },
        {
          workflowId: lookupKey,
          idempotencyKey,
          metadata: { userId, purpose, creditId },
        },
        DuplicateStrategy.RETURN_CACHED,
      );

      this.logger.log(`Retirement completed for workflow ${workflowId}`, {
        transactionHash: result.transactionHash,
        isDuplicate: result.isDuplicate,
        isCached: result.isCached,
        idempotencyKey,
      });

      return {
        success: true,
        cached: result.isCached,
        isDuplicate: result.isDuplicate,
        transactionHash: result.transactionHash,
        callId: result.callId,
        workflowId: result.workflowId,
        result: result.result,
        originalCallId: result.originalCallId,
        idempotencyKey,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Retirement failed for workflow ${workflowId}`, {
        error: err.message,
        stack: err.stack,
        idempotencyKey,
      });

      // If we have an idempotency key, record the failure
      if (idempotencyKey) {
        await this.idempotencyKeyService['recordFailedCall'](
          idempotencyKey,
          companyId,
          err.message,
        );
      }

      // Re-throw with proper domain error
      throw error;
    }
  }

  /**
   * Get retirement status by workflow ID
   */
  async getRetirementStatus(
    companyId: string,
    workflowId: string,
  ): Promise<RetirementStatusResult> {
    const call = await this.idempotencyService.getContractCallByWorkflow(
      companyId,
      workflowId,
      'retire',
    );

    if (!call) {
      return {
        found: false,
        status: 'NOT_FOUND',
        workflowId,
      };
    }

    return {
      found: true,
      status: call.status,
      transactionHash: call.transactionHash,
      result: call.result,
      submittedAt: call.submittedAt,
      confirmedAt: call.confirmedAt,
      isDuplicate: call.isDuplicate,
      workflowId: call.workflowId,
    };
  }

  /**
   * Check if a retirement has been processed
   */
  async isRetirementProcessed(
    companyId: string,
    workflowId: string,
  ): Promise<boolean> {
    return this.idempotencyService.isWorkflowProcessed(
      companyId,
      workflowId,
      'retire',
    );
  }
}
