import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { KeyManagementService } from './key-management.service';
import {
  IWalletResponse,
  WalletStatus,
  ITransactionSubmit,
  ITransactionResponse,
  TransactionStatus,
  OperationType,
} from '../interfaces/stellar.interface';
import { CreateWalletDto } from '../dto/wallet.dto';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly keyManagementService: KeyManagementService,
  ) {}

  /**
   * Create a new corporate wallet with secure key storage
   * Note: Database persistence disabled - models removed from schema
   */
  async createWallet(dto: CreateWalletDto): Promise<IWalletResponse> {
    const { companyId } = dto;

    // Generate new Stellar keypair
    const keypair = this.keyManagementService.generateKeypair();

    // TODO: Re-implement database persistence when models are restored
    this.logger.warn(
      `Wallet creation for company ${companyId} - database persistence disabled. Models removed from schema.`,
    );

    // Return mock response
    return {
      id: `mock-wallet-${companyId}`,
      companyId,
      publicKey: keypair.publicKey,
      status: WalletStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Get wallet by company ID
   * Note: Database persistence disabled - models removed from schema
   */
  async getWalletByCompanyId(companyId: string): Promise<IWalletResponse> {
    this.logger.warn(
      `Get wallet for company ${companyId} - database persistence disabled. Models removed from schema.`,
    );

    // Return mock response
    return {
      id: `mock-wallet-${companyId}`,
      companyId,
      publicKey: 'GMOCKPUBLICKEY123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      status: WalletStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Get wallet by public key
   * Note: Database persistence disabled - models removed from schema
   */
  async getWalletByPublicKey(publicKey: string): Promise<IWalletResponse> {
    this.logger.warn(
      `Get wallet for public key ${publicKey} - database persistence disabled. Models removed from schema.`,
    );

    // Return mock response
    return {
      id: 'mock-wallet-id',
      companyId: 'mock-company',
      publicKey,
      status: WalletStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Update wallet status
   * Note: Database persistence disabled - models removed from schema
   */
  async updateWalletStatus(
    companyId: string,
    status: WalletStatus,
  ): Promise<IWalletResponse> {
    this.logger.warn(
      `Update wallet ${companyId} status to ${status} - database persistence disabled. Models removed from schema.`,
    );

    // Return mock response
    return {
      id: `mock-wallet-${companyId}`,
      companyId,
      publicKey: 'GMOCKPUBLICKEY123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Check if wallet is active
   */
  async isWalletActive(companyId: string): Promise<boolean> {
    const wallet = await this.getWalletByCompanyId(companyId);
    return wallet.status === WalletStatus.ACTIVE;
  }

  /**
   * Get decrypted secret key (use with caution - only for signing transactions)
   * Note: Database persistence disabled - models removed from schema
   */
  async getSecretKey(companyId: string): Promise<string> {
    this.logger.warn(
      `Get secret key for company ${companyId} - database persistence disabled. Models removed from schema.`,
    );

    // Return mock secret key
    return 'mock-secret-key-for-testing-only';
  }

  /**
   * Get public key for a company
   */
  async getPublicKey(companyId: string): Promise<string> {
    const wallet = await this.getWalletByCompanyId(companyId);
    return wallet.publicKey;
  }

  /**
   * Record a wallet transaction
   * Note: Database persistence disabled - models removed from schema
   */
  async recordTransaction(
    data: ITransactionSubmit,
  ): Promise<ITransactionResponse> {
    this.logger.warn(
      `Record transaction for wallet ${data.walletId} - database persistence disabled. Models removed from schema.`,
    );

    // Return mock response
    return {
      id: `mock-tx-${Date.now()}`,
      companyId: data.companyId,
      walletId: data.walletId,
      transactionHash: data.transactionHash,
      operationType: data.operationType,
      status: TransactionStatus.PENDING,
      amount: data.amount,
      tokenIds: data.tokenIds,
      metadata: data.metadata || {},
      submittedAt: new Date(),
    };
  }

  /**
   * Update transaction status
   * Note: Database persistence disabled - models removed from schema
   */
  async updateTransactionStatus(
    transactionHash: string,
    status: TransactionStatus,
    confirmedAt?: Date,
  ): Promise<ITransactionResponse> {
    this.logger.warn(
      `Update transaction ${transactionHash} status to ${status} - database persistence disabled. Models removed from schema.`,
    );

    // Return mock response
    return {
      id: 'mock-tx-id',
      companyId: 'mock-company',
      walletId: 'mock-wallet',
      transactionHash,
      operationType: OperationType.TRANSFER,
      status,
      amount: 100,
      tokenIds: [1, 2, 3],
      submittedAt: new Date(),
      confirmedAt,
      metadata: {},
    };
  }

  /**
   * Get transactions for a company
   * Note: Database persistence disabled - models removed from schema
   */
  async getTransactions(companyId: string): Promise<ITransactionResponse[]> {
    this.logger.warn(
      `Get transactions for company ${companyId} - database persistence disabled. Models removed from schema.`,
    );

    // Return empty array
    return [];
  }
}
