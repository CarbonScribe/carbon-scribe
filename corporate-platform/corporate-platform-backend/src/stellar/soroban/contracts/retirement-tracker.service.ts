import { Injectable } from '@nestjs/common';
import { SorobanService } from '../soroban.service';
import {
  ContractInvocation,
  ContractSimulation,
  RETIREMENT_TRACKER_CONTRACT_ID,
} from './contract.interface';

@Injectable()
export class RetirementTrackerService {
  constructor(private readonly sorobanService: SorobanService) {}

  getContractId() {
    return (
      process.env.RETIREMENT_TRACKER_CONTRACT_ID ||
      process.env.STELLAR_RETIREMENT_TRACKER_CONTRACT_ID ||
      RETIREMENT_TRACKER_CONTRACT_ID
    );
  }

  invoke(payload: Omit<ContractInvocation, 'contractId'>) {
    return this.sorobanService.invokeContract({
      ...payload,
      contractId: this.getContractId(),
    });
  }

  simulate(payload: Omit<ContractSimulation, 'contractId'>) {
    return this.sorobanService.simulateContractCall({
      ...payload,
      contractId: this.getContractId(),
    });
  }

  async getRetirementRecord(
    txHash: string,
  ): Promise<Record<string, unknown> | null> {
    const methods = [
      'get_retirement_by_tx_hash',
      'get_retirement',
      'retirement_by_tx_hash',
      'verify_retirement',
    ];

    for (const method of methods) {
      try {
        const response = await this.simulate({
          methodName: method,
          args: [
            {
              type: 'string',
              value: txHash,
            },
          ],
        });

        const result = (response as any).result;
        if (result && typeof result === 'object') {
          return result as Record<string, unknown>;
        }
      } catch {
        // Try next method for ABI compatibility.
      }
    }

    return null;
  }

  // ========== RETIREMENT METHODS (Issue #232) ==========

  async retire(
    tokenId: string,
    amount: string,
    entityAddress: string,
    reason: string,
  ) {
    return this.invoke({
      methodName: 'retire',
      args: [
        { type: 'string', value: tokenId },
        { type: 'string', value: amount },
        { type: 'string', value: entityAddress },
        { type: 'string', value: reason },
      ],
    });
  }

  async batchRetire(
    tokenIds: string[],
    amounts: string[],
    entityAddress: string,
    reason: string,
  ) {
    return this.invoke({
      methodName: 'batch_retire',
      args: [
        { type: 'array', value: tokenIds },
        { type: 'array', value: amounts },
        { type: 'string', value: entityAddress },
        { type: 'string', value: reason },
      ],
    });
  }

  async getRetirementsByEntity(
    address: string,
    page: number,
    limit: number,
  ) {
    return this.invoke({
      methodName: 'get_retirements_by_entity',
      args: [
        { type: 'string', value: address },
        { type: 'number', value: page },
        { type: 'number', value: limit },
      ],
    });
  }
}
