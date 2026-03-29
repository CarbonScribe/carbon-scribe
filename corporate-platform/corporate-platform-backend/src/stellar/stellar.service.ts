import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { WalletService } from './services/wallet.service';
import { BalanceService } from './services/balance.service';
import { KeyManagementService } from './services/key-management.service';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  IHealthCheckResponse,
  IWalletResponse,
  IBalanceResponse,
  ITransactionResponse,
  ITransactionSubmit,
  TransactionStatus,
} from './interfaces/stellar.interface';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private readonly networkPassphrase: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly walletService: WalletService,
    private readonly balanceService: BalanceService,
    private readonly keyManagementService: KeyManagementService,
  ) {
    const stellarConfig = this.configService.getStellarConfig();
    this.networkPassphrase =
      stellarConfig.networkPassphrase ||
      this.getDefaultNetworkPassphrase(stellarConfig.network);
  }

  /**
   * Get the configured network
   */
  getNetwork(): string {
    return this.configService.getStellarConfig().network;
  }

  /**
   * Get the network passphrase
   */
  getNetworkPassphrase(): string {
    return this.networkPassphrase;
  }

  /**
   * Health check for Stellar network connectivity
   */
  async healthCheck(): Promise<IHealthCheckResponse> {
    return this.balanceService.healthCheck();
  }

  /**
   * Create a new wallet for a company
   */
  async createWallet(companyId: string): Promise<IWalletResponse> {
    return this.walletService.createWallet({ companyId });
  }

  /**
   * Get wallet by company ID
   */
  async getWallet(companyId: string): Promise<IWalletResponse> {
    return this.walletService.getWalletByCompanyId(companyId);
  }

  /**
   * Get wallet balances
   */
  async getBalances(companyId: string): Promise<IBalanceResponse> {
    return this.balanceService.getBalances(companyId);
  }

  /**
   * Get XLM balance only
   */
  async getXlmBalance(companyId: string): Promise<string> {
    return this.balanceService.getXlmBalance(companyId);
  }

  /**
   * Check if wallet is active
   */
  async isWalletActive(companyId: string): Promise<boolean> {
    return this.walletService.isWalletActive(companyId);
  }

  /**
   * Get decrypted secret key for signing transactions
   */
  async getSigningKey(companyId: string): Promise<string> {
    return this.walletService.getSecretKey(companyId);
  }

  /**
   * Get public key for a company
   */
  async getPublicKey(companyId: string): Promise<string> {
    return this.walletService.getPublicKey(companyId);
  }

  /**
   * Record a transaction
   */
  async recordTransaction(
    data: ITransactionSubmit,
  ): Promise<ITransactionResponse> {
    return this.walletService.recordTransaction(data);
  }

  /**
   * Get transactions for a company
   */
  async getTransactions(companyId: string): Promise<ITransactionResponse[]> {
    return this.walletService.getTransactions(companyId);
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(
    transactionHash: string,
    status: TransactionStatus,
    confirmedAt?: Date,
  ): Promise<ITransactionResponse> {
    return this.walletService.updateTransactionStatus(
      transactionHash,
      status,
      confirmedAt,
    );
  }

  /**
   * Validate a Stellar address
   */
  validateAddress(address: string): boolean {
    return this.keyManagementService.validatePublicKey(address);
  }

  /**
   * Generate a new encryption key (for setup)
   */
  generateEncryptionKey(): string {
    return this.keyManagementService.generateEncryptionKey();
  }

  /**
   * Get default network passphrase based on network
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
