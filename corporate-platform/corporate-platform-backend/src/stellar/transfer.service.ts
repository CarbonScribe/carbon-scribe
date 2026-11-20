import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  SIGNING_PROVIDER_TRANSFER,
  SigningProvider,
} from './signing/signing-provider.interface';
import { PrismaService } from '../shared/database/prisma.service';
import {
  InitiateTransferDto,
  TransferHistoryQueryDto,
} from './dto/transfer.dto';
import * as StellarSdk from '@stellar/stellar-sdk';
import { nativeToScVal } from '@stellar/stellar-sdk';

/**
 * On-chain lifecycle of a credit transfer (FE-069).
 *
 * The UI needs to distinguish "we accepted this a second ago" from "this has
 * been sitting unconfirmed for ten minutes", which a single PENDING state
 * cannot express.
 *
 *  SUBMITTED — accepted by the API; the transaction has not yet been
 *              acknowledged by the network.
 *  PENDING   — broadcast and acknowledged; awaiting on-chain confirmation.
 *  CONFIRMED — landed on-chain (terminal).
 *  FAILED    — rejected or exhausted retries (terminal).
 */
export const TRANSFER_STATES = {
  SUBMITTED: 'SUBMITTED',
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
} as const;

export type TransferState =
  (typeof TRANSFER_STATES)[keyof typeof TRANSFER_STATES];

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);
  private readonly rpcServer: StellarSdk.rpc.Server;
  private readonly networkPassphrase = StellarSdk.Networks.TESTNET;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SIGNING_PROVIDER_TRANSFER)
    private readonly signingProvider: SigningProvider,
  ) {
    this.rpcServer = new StellarSdk.rpc.Server(
      'https://soroban-testnet.stellar.org',
    );
  }

  async getTransferStatus(purchaseId: string) {
    const prisma = this.prisma as any;
    const transfer = await prisma.creditTransfer.findUnique({
      where: { purchaseId },
    });
    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }
    return transfer;
  }

  async getTransferHistory(companyId: string, query: TransferHistoryQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(Math.max(1, query.limit || 20), 100);
    const where: any = { companyId };
    if (query.status) where.status = query.status;

    const conditions: any[] = [];
    if (query.walletAddress?.trim()) {
      const wallet = query.walletAddress.trim();
      conditions.push({
        OR: [
          { fromAddress: { contains: wallet, mode: 'insensitive' } },
          { toAddress: { contains: wallet, mode: 'insensitive' } },
        ],
      });
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      conditions.push({
        OR: [
          { purchaseId: { contains: search, mode: 'insensitive' } },
          { transactionHash: { contains: search, mode: 'insensitive' } },
          { fromAddress: { contains: search, mode: 'insensitive' } },
          { toAddress: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (conditions.length) where.AND = conditions;

    if (query.fromDate || query.toDate) {
      where.initiatedAt = {};
      if (query.fromDate) where.initiatedAt.gte = new Date(query.fromDate);
      if (query.toDate) {
        const endOfDay = query.toDate.length === 10
          ? `${query.toDate}T23:59:59.999Z`
          : query.toDate;
        where.initiatedAt.lte = new Date(endOfDay);
      }
    }

    const prisma = this.prisma as any;
    const [data, total] = await Promise.all([
      prisma.creditTransfer.findMany({
        where,
        orderBy: { initiatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.creditTransfer.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async initiateTransfer(dto: InitiateTransferDto) {
    // Determine the real address to transfer to/from
    // In a real app we'd fetch the company's wallet address from the DB
    const toAddress = dto.toAddress || 'GA...'; // placeholder
    const fromAddress = dto.fromAddress || 'GB...'; // placeholder
    const contractId =
      dto.contractId ||
      'CAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM';

    const prisma = this.prisma as any;
    const submittedAt = new Date();
    const transfer = await prisma.creditTransfer.create({
      data: {
        purchaseId: dto.purchaseId,
        companyId: dto.companyId,
        projectId: dto.projectId,
        amount: dto.amount,
        fromAddress,
        toAddress,
        // The transaction has been accepted but not yet broadcast — this is
        // materially different from "broadcast, awaiting confirmation", and the
        // UI renders the two distinctly.
        status: TRANSFER_STATES.SUBMITTED,
        submittedAt,
      },
    });

    // Execute transfer asynchronously
    this.executeTransferWithRetry(
      transfer.id,
      contractId,
      fromAddress,
      toAddress,
      dto.amount,
    ).catch((err) => this.logger.error(`Transfer ${transfer.id} failed`, err));

    return transfer;
  }

  async batchTransfer(transfers: InitiateTransferDto[]) {
    const results = [];
    for (const dto of transfers) {
      results.push(await this.initiateTransfer(dto));
    }
    return results;
  }

  private async executeTransferWithRetry(
    transferId: string,
    contractId: string,
    fromAddress: string,
    toAddress: string,
    amount: number,
    retryCount = 0,
  ) {
    try {
      this.logger.log(
        `Executing transfer ${transferId} (try ${retryCount + 1})`,
      );

      // Sign through SigningProvider — simulate only when STELLAR_SIGNING_MODE!=live
      if (this.signingProvider.isLive()) {
        const publicKey = await this.signingProvider.getPublicKey();
        const sourceAccount = await this.rpcServer.getAccount(publicKey);

        const contract = new StellarSdk.Contract(contractId);
        const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
          fee: '1000',
          networkPassphrase: this.networkPassphrase,
        })
          .addOperation(
            contract.call(
              'transfer_from',
              nativeToScVal(publicKey, { type: 'address' }),
              nativeToScVal(fromAddress, { type: 'address' }),
              nativeToScVal(toAddress, { type: 'address' }),
              nativeToScVal(amount, { type: 'i128' }),
            ),
          )
          .setTimeout(30)
          .build();

        const signed = await this.signingProvider.signTransaction(
          tx.toXDR(),
          this.networkPassphrase,
        );
        this.logger.log(
          JSON.stringify({
            event: 'transfer_signed',
            transferId,
            signingPublicKey: signed.publicKey,
            keyId: signed.keyId ?? this.signingProvider.keyId,
          }),
        );
        const signedTx = StellarSdk.TransactionBuilder.fromXDR(
          signed.signedXdr,
          this.networkPassphrase,
        );

        const response = await this.rpcServer.sendTransaction(signedTx as any);

        if (response.status === 'ERROR') {
          throw new Error(`Stellar RPC Error: ${JSON.stringify(response)}`);
        }

        const hash = response.hash;

        const prisma = this.prisma as any;
        await prisma.creditTransfer.update({
          where: { id: transferId },
          data: {
            transactionHash: hash,
            status: TRANSFER_STATES.PENDING,
          },
        });

        await prisma.creditTransfer.update({
          where: { id: transferId },
          data: {
            status: TRANSFER_STATES.CONFIRMED,
            confirmedAt: new Date(),
          },
        });
      } else {
        this.logger.warn(
          `STELLAR_SIGNING_MODE is not live — simulating transfer ${transferId} ` +
            `(keyId=${this.signingProvider.keyId})`,
        );
        const mockHash = `simulated_tx_${Date.now()}`;
        const prisma = this.prisma as any;
        await prisma.creditTransfer.update({
          where: { id: transferId },
          data: {
            transactionHash: mockHash,
            status: TRANSFER_STATES.CONFIRMED,
            confirmedAt: new Date(),
          },
        });
      }
    } catch (error) {
      this.logger.error(`Error executing transfer ${transferId}:`, error);

      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        setTimeout(() => {
          this.executeTransferWithRetry(
            transferId,
            contractId,
            fromAddress,
            toAddress,
            amount,
            retryCount + 1,
          );
        }, delay);
      } else {
        const prisma = this.prisma as any;
        await prisma.creditTransfer.update({
          where: { id: transferId },
          data: {
            status: TRANSFER_STATES.FAILED,
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  }
}
