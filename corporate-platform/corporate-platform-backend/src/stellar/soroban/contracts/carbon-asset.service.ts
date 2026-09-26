import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SorobanService } from '../soroban.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import {
  CARBON_ASSET_CONTRACT_ID,
  ContractInvocation,
  ContractSimulation,
} from './contract.interface';
import {
  IdempotencyOptions,
  IdempotentContractResult,
  ContractCallStatus,
  DuplicateStrategy,
} from '../interfaces/idempotency.interface';

@Injectable()
export class CarbonAssetService {
  private readonly logger = new Logger(CarbonAssetService.name);

  constructor(
    private readonly sorobanService: SorobanService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  getContractId() {
    return (
      process.env.CARBON_ASSET_CONTRACT_ID ||
      process.env.STELLAR_CARBON_ASSET_CONTRACT_ID ||
      CARBON_ASSET_CONTRACT_ID
    );
  }

  /**
   * Invoke a contract method with idempotency support
   *
   * @param companyId - The company ID for the contract call
   * @param payload - The contract invocation payload
   * @param options - Idempotency options including workflowId
   * @param strategy - Duplicate handling strategy
   * @returns Idempotent contract result with caching information
   */
  async invokeWithIdempotency<T = unknown>(
    companyId: string,
    payload: Omit<ContractInvocation, 'contractId'>,
    options: IdempotencyOptions,
    strategy: DuplicateStrategy = DuplicateStrategy.RETURN_CACHED,
  ): Promise<IdempotentContractResult<T>> {
    // Validate workflow ID
    if (!options.workflowId) {
      throw new BadRequestException(
        'workflowId is required for idempotent contract calls',
      );
    }

    // Check for duplicate
    const dedupCheck = await this.idempotencyService.checkAndHandleDuplicate(
      companyId,
      this.getContractId(),
      payload.methodName,
      payload.args,
      options,
      strategy,
    );

    // If duplicate and returning cached result
    if (dedupCheck.isDuplicate && !dedupCheck.shouldProceed) {
      const existingCall = dedupCheck.existingCall!;
      return {
        result: existingCall.result as T,
        transactionHash: existingCall.transactionHash,
        isCached: true,
        callId: existingCall.id,
        workflowId: options.workflowId,
        idempotencyKey: existingCall.idempotencyKey,
        status: existingCall.status as ContractCallStatus,
        isDuplicate: true,
        originalCallId: existingCall.id,
      };
    }

    // Execute the contract call
    try {
      const response = await this.sorobanService.invokeContract({
        ...payload,
        contractId: this.getContractId(),
      });

      // Fix: Use transactionHash only (remove .hash as it doesn't exist on ContractExecutionResult)
      const transactionHash = response.transactionHash || '';

      // Create contract call record with idempotency
      const callRecord = await this.idempotencyService.createContractCall(
        companyId,
        this.getContractId(),
        payload.methodName,
        payload.args,
        transactionHash,
        options,
        dedupCheck.deduplicationKey,
      );

      // If duplicate and allowed to proceed, mark as duplicate
      if (dedupCheck.isDuplicate && dedupCheck.shouldProceed) {
        await this.idempotencyService.markDuplicate(
          callRecord.id,
          dedupCheck.existingCall!.id,
          'Duplicate submission allowed with ALLOW strategy',
        );
      }

      // Confirm the call
      const confirmed = await this.idempotencyService.confirmContractCall(
        callRecord.id,
        response.result,
      );

      return {
        result: response.result as T,
        transactionHash,
        isCached: false,
        callId: callRecord.id,
        workflowId: options.workflowId,
        idempotencyKey: callRecord.idempotencyKey,
        status: confirmed.status as ContractCallStatus,
        isDuplicate: dedupCheck.isDuplicate && dedupCheck.shouldProceed,
        originalCallId: dedupCheck.isDuplicate
          ? dedupCheck.existingCall?.id
          : undefined,
      };
    } catch (error) {
      // Handle failure - will be retried later
      this.logger.error(`Contract call failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Invoke a contract method (non-idempotent - for backward compatibility)
   */
  invoke(payload: Omit<ContractInvocation, 'contractId'>) {
    return this.sorobanService.invokeContract({
      ...payload,
      contractId: this.getContractId(),
    });
  }

  /**
   * Simulate a contract call (non-idempotent - for read operations)
   */
  simulate(payload: Omit<ContractSimulation, 'contractId'>) {
    return this.sorobanService.simulateContractCall({
      ...payload,
      contractId: this.getContractId(),
    });
  }

  /**
   * Get credit balance (non-idempotent - for read operations)
   */
  async getCreditBalance(address: string): Promise<number> {
    const methods = ['balance', 'get_balance', 'balance_of'];

    for (const method of methods) {
      try {
        const response = await this.simulate({
          methodName: method,
          args: [
            {
              type: 'address',
              value: address,
            },
          ],
        });

        const result = Number((response as any).result ?? 0);
        if (Number.isFinite(result)) {
          return result;
        }
      } catch {
        // Try the next method name for ABI compatibility.
      }
    }

    return 0;
  }

  /**
   * Get credit balance with idempotency support
   */
  async getCreditBalanceWithIdempotency(
    companyId: string,
    address: string,
    workflowId: string,
  ): Promise<IdempotentContractResult<number>> {
    return this.invokeWithIdempotency<number>(
      companyId,
      {
        companyId, // Add missing companyId
        methodName: 'balance',
        args: [{ type: 'address', value: address }],
      },
      {
        workflowId,
        metadata: { operation: 'getCreditBalance', address },
      },
      DuplicateStrategy.RETURN_CACHED,
    );
  }

  /**
   * List owned token IDs (non-idempotent - for read operations)
   */
  async listOwnedTokenIds(address: string): Promise<number[]> {
    const methods = ['tokens_of', 'owned_tokens', 'get_tokens', 'token_ids'];

    for (const method of methods) {
      try {
        const response = await this.simulate({
          methodName: method,
          args: [
            {
              type: 'address',
              value: address,
            },
          ],
        });

        const raw = (response as any).result;
        if (Array.isArray(raw)) {
          return raw
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value));
        }
      } catch {
        // Try the next method name for ABI compatibility.
      }
    }

    return [];
  }

  /**
   * List owned token IDs with idempotency support
   */
  async listOwnedTokenIdsWithIdempotency(
    companyId: string,
    address: string,
    workflowId: string,
  ): Promise<IdempotentContractResult<number[]>> {
    return this.invokeWithIdempotency<number[]>(
      companyId,
      {
        companyId, // Add missing companyId
        methodName: 'tokens_of',
        args: [{ type: 'address', value: address }],
      },
      {
        workflowId,
        metadata: { operation: 'listOwnedTokenIds', address },
      },
      DuplicateStrategy.RETURN_CACHED,
    );
  }

  /**
   * Get token metadata (non-idempotent - for read operations)
   */
  async getTokenMetadata(
    tokenId: number,
  ): Promise<Record<string, unknown> | null> {
    const methods = ['token_metadata', 'get_token_metadata', 'metadata'];

    for (const method of methods) {
      try {
        const response = await this.simulate({
          methodName: method,
          args: [
            {
              type: 'u32',
              value: tokenId,
            },
          ],
        });

        const result = (response as any).result;
        if (result && typeof result === 'object') {
          return result as Record<string, unknown>;
        }
      } catch {
        // Try the next method name for ABI compatibility.
      }
    }

    return null;
  }

  /**
   * Get token metadata with idempotency support
   */
  async getTokenMetadataWithIdempotency(
    companyId: string,
    tokenId: number,
    workflowId: string,
  ): Promise<IdempotentContractResult<Record<string, unknown> | null>> {
    return this.invokeWithIdempotency<Record<string, unknown> | null>(
      companyId,
      {
        companyId, // Add missing companyId
        methodName: 'token_metadata',
        args: [{ type: 'u32', value: tokenId }],
      },
      {
        workflowId,
        metadata: { operation: 'getTokenMetadata', tokenId },
      },
      DuplicateStrategy.RETURN_CACHED,
    );
  }

  /**
   * Get token status (non-idempotent - for read operations)
   */
  async getTokenStatus(tokenId: number): Promise<string> {
    const methods = ['token_status', 'get_token_status', 'status_of'];

    for (const method of methods) {
      try {
        const response = await this.simulate({
          methodName: method,
          args: [
            {
              type: 'u32',
              value: tokenId,
            },
          ],
        });

        const status = (response as any).result;
        if (status !== null && status !== undefined) {
          return String(status);
        }
      } catch {
        // Try the next method name for ABI compatibility.
      }
    }

    return 'UNKNOWN';
  }

  /**
   * Get token status with idempotency support
   */
  async getTokenStatusWithIdempotency(
    companyId: string,
    tokenId: number,
    workflowId: string,
  ): Promise<IdempotentContractResult<string>> {
    return this.invokeWithIdempotency<string>(
      companyId,
      {
        companyId, // Add missing companyId
        methodName: 'token_status',
        args: [{ type: 'u32', value: tokenId }],
      },
      {
        workflowId,
        metadata: { operation: 'getTokenStatus', tokenId },
      },
      DuplicateStrategy.RETURN_CACHED,
    );
  }

  /**
   * Transfer tokens with idempotency support
   */
  async transferWithIdempotency(
    companyId: string,
    from: string,
    to: string,
    tokenId: number,
    amount: number,
    workflowId: string,
  ): Promise<IdempotentContractResult<unknown>> {
    return this.invokeWithIdempotency(
      companyId,
      {
        companyId, // Add missing companyId
        methodName: 'transfer',
        args: [
          { type: 'address', value: from },
          { type: 'address', value: to },
          { type: 'u32', value: tokenId },
          { type: 'u32', value: amount },
        ],
      },
      {
        workflowId,
        metadata: { operation: 'transfer', from, to, tokenId, amount },
      },
      DuplicateStrategy.RETURN_CACHED,
    );
  }

  /**
   * Retire tokens with idempotency support
   */
  async retireWithIdempotency(
    companyId: string,
    tokenId: number,
    amount: number,
    purpose: string,
    workflowId: string,
  ): Promise<IdempotentContractResult<unknown>> {
    return this.invokeWithIdempotency(
      companyId,
      {
        companyId, // Add missing companyId
        methodName: 'retire',
        args: [
          { type: 'u32', value: tokenId },
          { type: 'u32', value: amount },
          { type: 'string', value: purpose },
        ],
      },
      {
        workflowId,
        metadata: { operation: 'retire', tokenId, amount, purpose },
      },
      DuplicateStrategy.RETURN_CACHED,
    );
  }

  /**
   * Mint tokens with idempotency support
   */
  async mintWithIdempotency(
    companyId: string,
    to: string,
    amount: number,
    metadata: Record<string, unknown>,
    workflowId: string,
  ): Promise<IdempotentContractResult<unknown>> {
    return this.invokeWithIdempotency(
      companyId,
      {
        companyId, // Add missing companyId
        methodName: 'mint',
        args: [
          { type: 'address', value: to },
          { type: 'u32', value: amount },
          { type: 'string', value: JSON.stringify(metadata) },
        ],
      },
      {
        workflowId,
        metadata: { operation: 'mint', to, amount },
      },
      DuplicateStrategy.RETURN_CACHED,
    );
  }
}
