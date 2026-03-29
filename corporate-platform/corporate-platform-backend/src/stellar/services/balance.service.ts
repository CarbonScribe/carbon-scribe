import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as StellarSdk from '@stellar/stellar-sdk';
import { ConfigService } from '../../config/config.service';
import { WalletService } from './wallet.service';
import { 
  IBalanceResponse, 
  ICarbonCreditBalance,
  IHealthCheckResponse 
} from '../interfaces/stellar.interface';
import { BalanceResponseDto } from '../dto/balance.dto';

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);
  private readonly horizon: StellarSdk.Horizon.Server;
  private readonly rpc: StellarSdk.rpc.Server;
  private readonly networkPassphrase: string;
  private readonly carbonAssetContractId: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly walletService: WalletService,
  ) {
    const stellarConfig = this.configService.getStellarConfig();
    
    // Initialize Horizon server
    const horizonUrl = stellarConfig.horizonUrl || this.getDefaultHorizonUrl(stellarConfig.network);
    this.horizon = new StellarSdk.Horizon.Server(horizonUrl);
    
    // Initialize Soroban RPC server
    const sorobanRpcUrl = stellarConfig.sorobanRpcUrl || this.getDefaultSorobanRpcUrl(stellarConfig.network);
    this.rpc = new StellarSdk.rpc.Server(sorobanRpcUrl);
    
    // Set network passphrase
    this.networkPassphrase = stellarConfig.networkPassphrase || this.getDefaultNetworkPassphrase(stellarConfig.network);
    this.carbonAssetContractId = stellarConfig.carbonAssetContractId;
  }

  /**
   * Get XLM and carbon credit balances for a company
   */
  async getBalances(companyId: string): Promise<BalanceResponseDto> {
    const publicKey = await this.walletService.getPublicKey(companyId);
    
    try {
      // Get account balances from Horizon
      const account = await this.horizon.loadAccount(publicKey);
      
      // Find XLM balance
      const xlmBalance = account.balances.find(
        (b: any) => b.asset_type === 'native'
      ) as any;

      // Get carbon credit balances from Soroban contract
      const carbonCredits = await this.getCarbonCreditBalances(publicKey);

      return {
        xlm: {
          balance: xlmBalance?.balance || '0',
          assetType: 'native',
        },
        carbonCredits,
      };
    } catch (error) {
      this.logger.error(`Failed to get balances for ${publicKey}: ${error.message}`);
      
      // Return zero balances if account not found (not funded yet)
      if (error.response?.status === 404) {
        return {
          xlm: {
            balance: '0',
            assetType: 'native',
          },
          carbonCredits: [],
        };
      }
      
      throw error;
    }
  }

  /**
   * Get XLM balance only
   */
  async getXlmBalance(companyId: string): Promise<string> {
    const publicKey = await this.walletService.getPublicKey(companyId);
    
    try {
      const account = await this.horizon.loadAccount(publicKey);
      const xlmBalance = account.balances.find(
        (b: any) => b.asset_type === 'native'
      ) as any;
      
      return xlmBalance?.balance || '0';
    } catch (error) {
      if (error.response?.status === 404) {
        return '0';
      }
      throw error;
    }
  }

  /**
   * Get carbon credit token balances from the contract
   */
  private async getCarbonCreditBalances(publicKey: string): Promise<ICarbonCreditBalance[]> {
    if (!this.carbonAssetContractId) {
      this.logger.warn('Carbon asset contract ID not configured');
      return [];
    }

    try {
      // Build the contract invocation to get balance
      // This is a simplified example - actual implementation depends on the contract interface
      const contract = new StellarSdk.Contract(this.carbonAssetContractId);
      
      // Create a read-only transaction to simulate the contract call
      const account = await this.horizon.loadAccount(publicKey);
      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(contract.call('get_balance', StellarSdk.nativeToScVal(publicKey, { type: 'address' })))
        .setTimeout(30)
        .build();

      // Simulate the transaction to get the result
      const result = await this.rpc.simulateTransaction(transaction);
      
      if (result && 'result' in result && result.result) {
        // Parse the result based on contract return type
        // This is a placeholder - actual parsing depends on contract
        return this.parseCarbonCreditBalances(result);
      }

      return [];
    } catch (error) {
      this.logger.error(`Failed to get carbon credit balances: ${error.message}`);
      return [];
    }
  }

  /**
   * Parse carbon credit balances from contract response
   */
  private parseCarbonCreditBalances(simulationResult: any): ICarbonCreditBalance[] {
    // This is a placeholder implementation
    // Actual implementation depends on the contract return structure
    try {
      if (simulationResult.result?.retval) {
        const decoded = StellarSdk.scValToNative(simulationResult.result.retval);
        
        // Assuming decoded is an array of { tokenId, balance } objects
        if (Array.isArray(decoded)) {
          return decoded.map((item: any) => ({
            tokenId: Number(item.token_id || item.tokenId),
            balance: Number(item.balance),
            assetCode: item.asset_code,
            issuer: item.issuer,
          }));
        }
      }
      return [];
    } catch (error) {
      this.logger.error(`Failed to parse carbon credit balances: ${error.message}`);
      return [];
    }
  }

  /**
   * Health check for Stellar network connectivity
   */
  async healthCheck(): Promise<IHealthCheckResponse> {
    const stellarConfig = this.configService.getStellarConfig();
    const startTime = Date.now();
    
    try {
      // Check Horizon connectivity
      await this.horizon.root();
      
      // Check Soroban RPC connectivity (if contract ID is configured)
      if (this.carbonAssetContractId) {
        await this.rpc.getHealth();
      }

      const latency = Date.now() - startTime;

      return {
        status: 'healthy',
        network: stellarConfig.network,
        horizonUrl: stellarConfig.horizonUrl || this.getDefaultHorizonUrl(stellarConfig.network),
        sorobanRpcUrl: stellarConfig.sorobanRpcUrl || this.getDefaultSorobanRpcUrl(stellarConfig.network),
        lastChecked: new Date(),
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        network: stellarConfig.network,
        horizonUrl: stellarConfig.horizonUrl || this.getDefaultHorizonUrl(stellarConfig.network),
        sorobanRpcUrl: stellarConfig.sorobanRpcUrl || this.getDefaultSorobanRpcUrl(stellarConfig.network),
        lastChecked: new Date(),
        latency: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Get default Horizon URL based on network
   */
  private getDefaultHorizonUrl(network: string): string {
    switch (network) {
      case 'mainnet':
        return 'https://horizon.stellar.org';
      case 'testnet':
        return 'https://horizon-testnet.stellar.org';
      case 'futurenet':
        return 'https://horizon-futurenet.stellar.org';
      default:
        return 'https://horizon-testnet.stellar.org';
    }
  }

  /**
   * Get default Soroban RPC URL based on network
   */
  private getDefaultSorobanRpcUrl(network: string): string {
    switch (network) {
      case 'mainnet':
        return 'https://soroban-rpc.stellar.org';
      case 'testnet':
        return 'https://soroban-testnet.stellar.org';
      case 'futurenet':
        return 'https://rpc-futurenet.stellar.org';
      default:
        return 'https://soroban-testnet.stellar.org';
    }
  }

  /**
   * Get default network passphrase
   */
  private getDefaultNetworkPassphrase(network: string): string {
    switch (network) {
      case 'mainnet':
        return StellarSdk.Networks.PUBLIC;
      case 'testnet':
        return StellarSdk.Networks.TESTNET;
      case 'futurenet':
        return StellarSdk.Networks.FUTURENET;
      default:
        return StellarSdk.Networks.TESTNET;
    }
  }
}
