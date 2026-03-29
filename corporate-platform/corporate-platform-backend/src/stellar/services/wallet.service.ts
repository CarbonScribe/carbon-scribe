import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
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
   */
  async createWallet(dto: CreateWalletDto): Promise<IWalletResponse> {
    const { companyId } = dto;

    // Check if wallet already exists for this company
    const existingWallet = await this.prisma.corporateWallet.findUnique({
      where: { companyId },
    });

    if (existingWallet) {
      throw new ConflictException(
        `Wallet already exists for company ${companyId}`,
      );
    }

    // Generate new Stellar keypair
    const keypair = this.keyManagementService.generateKeypair();

    // Encrypt the private key
    const encryptedSecret = this.keyManagementService.encryptPrivateKey(
      keypair.secret,
    );

    // Create wallet in database
    const wallet = await this.prisma.corporateWallet.create({
      data: {
        companyId,
        publicKey: keypair.publicKey,
        encryptedSecret: JSON.stringify(encryptedSecret),
        status: WalletStatus.ACTIVE,
      },
    });

    this.logger.log(
      `Created wallet for company ${companyId} with public key ${keypair.publicKey}`,
    );

    return this.mapToWalletResponse(wallet);
  }

  /**
   * Get wallet by company ID
   */
  async getWalletByCompanyId(companyId: string): Promise<IWalletResponse> {
    const wallet = await this.prisma.corporateWallet.findUnique({
      where: { companyId },
    });

    if (!wallet) {
      throw new NotFoundException(`Wallet not found for company ${companyId}`);
    }

    return this.mapToWalletResponse(wallet);
  }

  /**
   * Get wallet by public key
   */
  async getWalletByPublicKey(publicKey: string): Promise<IWalletResponse> {
    const wallet = await this.prisma.corporateWallet.findUnique({
      where: { publicKey },
    });

    if (!wallet) {
      throw new NotFoundException(
        `Wallet not found for public key ${publicKey}`,
      );
    }

    return this.mapToWalletResponse(wallet);
  }

  /**
   * Update wallet status
   */
  async updateWalletStatus(
    companyId: string,
    status: WalletStatus,
  ): Promise<IWalletResponse> {
    const wallet = await this.prisma.corporateWallet.update({
      where: { companyId },
      data: { status },
    });

    this.logger.log(
      `Updated wallet status for company ${companyId} to ${status}`,
    );

    return this.mapToWalletResponse(wallet);
  }

  /**
   * Check if wallet exists and is active
   */
  async isWalletActive(companyId: string): Promise<boolean> {
    const wallet = await this.prisma.corporateWallet.findUnique({
      where: { companyId },
      select: { status: true },
    });

    return wallet?.status === WalletStatus.ACTIVE;
  }

  /**
   * Get decrypted secret key (use with caution - only for signing transactions)
   */
  async getSecretKey(companyId: string): Promise<string> {
    const wallet = await this.prisma.corporateWallet.findUnique({
      where: { companyId },
    });

    if (!wallet) {
      throw new NotFoundException(`Wallet not found for company ${companyId}`);
    }

    if (wallet.status !== WalletStatus.ACTIVE) {
      throw new ConflictException(
        `Wallet is not active (status: ${wallet.status})`,
      );
    }

    const encryptedData = JSON.parse(wallet.encryptedSecret);
    return this.keyManagementService.decryptPrivateKey(encryptedData);
  }

  /**
   * Get public key for a company
   */
  async getPublicKey(companyId: string): Promise<string> {
    const wallet = await this.prisma.corporateWallet.findUnique({
      where: { companyId },
      select: { publicKey: true },
    });

    if (!wallet) {
      throw new NotFoundException(`Wallet not found for company ${companyId}`);
    }

    return wallet.publicKey;
  }

  /**
   * Record a wallet transaction
   */
  async recordTransaction(
    data: ITransactionSubmit,
  ): Promise<ITransactionResponse> {
    const transaction = await this.prisma.walletTransaction.create({
      data: {
        companyId: data.companyId,
        walletId: data.walletId,
        transactionHash: data.transactionHash,
        operationType: data.operationType,
        status: TransactionStatus.PENDING,
        amount: data.amount,
        tokenIds: data.tokenIds,
        metadata: (data.metadata || {}) as any,
      },
    });

    this.logger.log(
      `Recorded transaction ${data.transactionHash} for company ${data.companyId}`,
    );

    return this.mapToTransactionResponse(transaction);
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(
    transactionHash: string,
    status: TransactionStatus,
    confirmedAt?: Date,
  ): Promise<ITransactionResponse> {
    const transaction = await this.prisma.walletTransaction.update({
      where: { transactionHash },
      data: {
        status,
        confirmedAt,
      },
    });

    this.logger.log(
      `Updated transaction ${transactionHash} status to ${status}`,
    );

    return this.mapToTransactionResponse(transaction);
  }

  /**
   * Get transactions for a company
   */
  async getTransactions(companyId: string): Promise<ITransactionResponse[]> {
    const transactions = await this.prisma.walletTransaction.findMany({
      where: { companyId },
      orderBy: { submittedAt: 'desc' },
    });

    return transactions.map((t) => this.mapToTransactionResponse(t));
  }

  /**
   * Map database wallet to response DTO
   */
  private mapToWalletResponse(wallet: any): IWalletResponse {
    return {
      id: wallet.id,
      companyId: wallet.companyId,
      publicKey: wallet.publicKey,
      status: wallet.status as WalletStatus,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  /**
   * Map database transaction to response DTO
   */
  private mapToTransactionResponse(transaction: any): ITransactionResponse {
    return {
      id: transaction.id,
      companyId: transaction.companyId,
      walletId: transaction.walletId,
      transactionHash: transaction.transactionHash,
      operationType: transaction.operationType as OperationType,
      status: transaction.status as TransactionStatus,
      amount: transaction.amount,
      tokenIds: transaction.tokenIds,
      submittedAt: transaction.submittedAt,
      confirmedAt: transaction.confirmedAt || undefined,
      metadata: transaction.metadata as Record<string, unknown>,
    };
  }
}
