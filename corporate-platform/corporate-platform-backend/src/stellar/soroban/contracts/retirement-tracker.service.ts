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

  async getRecentRetirementEvents(): Promise<any[]> {
    try {
      // 1. Simulate a call to a batch retrieval method on your Soroban smart contract
      const response = await this.simulate({
        methodName: 'get_recent_retirements', // ◄ Ensure this matches your Rust/Soroban contract method name
        args: [
          {
            type: 'u32',
            value: '100', // Fetch latest 100 entries, or handle paging dynamically
          },
        ],
      });

      // 2. Extract and parse the raw event structures
      const result = (response as any).result;
      if (Array.isArray(result)) {
        return result.map((event: any) => ({
          // Normalize contract keys to the camelCase fields your aggregation service expects
          retiredAt:
            event.retired_at || event.timestamp || new Date().toISOString(),
          entity: event.entity || event.retired_by,
          assetType: event.asset_type || 'CARBON',
          project: event.project_id || event.project || 'Unknown',
          amount: Number(event.amount || 0),
        }));
      }

      return [];
    } catch {
      return [];
    }
  }
}
