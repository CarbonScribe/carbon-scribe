import { Injectable } from '@nestjs/common';
import { SorobanService } from '../soroban.service';
import {
  CARBON_ASSET_CONTRACT_ID,
  ContractInvocation,
  ContractSimulation,
} from './contract.interface';

@Injectable()
export class CarbonAssetService {
  constructor(private readonly sorobanService: SorobanService) {}

  getContractId() {
    return (
      process.env.CARBON_ASSET_CONTRACT_ID ||
      process.env.STELLAR_CARBON_ASSET_CONTRACT_ID ||
      CARBON_ASSET_CONTRACT_ID
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
}
