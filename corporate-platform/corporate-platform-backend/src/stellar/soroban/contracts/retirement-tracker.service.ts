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
}
