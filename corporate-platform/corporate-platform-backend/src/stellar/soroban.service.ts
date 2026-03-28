import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import * as StellarSdk from '@stellar/stellar-sdk';

@Injectable()
export class SorobanService {
  private readonly logger = new Logger(SorobanService.name);
  private readonly rpc: StellarSdk.rpc.Server;

  constructor(private readonly configService: ConfigService) {
    const stellarConfig = this.configService.getStellarConfig();
    // Assuming a Soroban RPC URL is available in config
    this.rpc = new StellarSdk.rpc.Server(stellarConfig.sorobanRpcUrl || 'https://soroban-testnet.stellar.org');
  }

  /**
   * Fetches events for a specific contract from a given start ledger
   */
  async getContractEvents(contractId: string, startLedger: number): Promise<any[]> {
    try {
      this.logger.debug(`Fetching events for contract ${contractId} from ledger ${startLedger}`);
      
      const response = await this.rpc.getEvents({
        startLedger,
        filters: [
          {
            type: 'contract',
            contractIds: [contractId],
          },
        ],
      });

      return response.events || [];
    } catch (error) {
      this.logger.error(`Failed to fetch Soroban events: ${error.message}`);
      return [];
    }
  }

  /**
   * Decodes ScVal from XDR into native Javascript types
   */
  decodeScVal(scVal: any): any {
    try {
      // In @stellar/stellar-sdk, scVal is often already decoded or provided as XDR
      // We use StellarSdk.scValToNative for the conversion
      return StellarSdk.scValToNative(scVal);
    } catch (error) {
      this.logger.warn(`Failed to decode ScVal: ${error.message}`);
      return scVal;
    }
  }
}
