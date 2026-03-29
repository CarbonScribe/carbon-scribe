import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { InitiateTransferDto } from './dto/transfer.dto';
import * as StellarSdk from '@stellar/stellar-sdk';
import { nativeToScVal } from '@stellar/stellar-sdk';

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);
  private readonly rpcServer: StellarSdk.rpc.Server;
  private readonly networkPassphrase = StellarSdk.Networks.TESTNET;

  constructor(private readonly prisma: PrismaService) {
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

  async initiateTransfer(dto: InitiateTransferDto) {
    // Determine the real address to transfer to/from
    // In a real app we'd fetch the company's wallet address from the DB
    const toAddress = dto.toAddress || 'GA...'; // placeholder
    const fromAddress = dto.fromAddress || 'GB...'; // placeholder
    const contractId =
      dto.contractId ||
      'CAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM';

    const prisma = this.prisma as any;
    const transfer = await prisma.creditTransfer.create({
      data: {
        purchaseId: dto.purchaseId,
        companyId: dto.companyId,
        projectId: dto.projectId,
        amount: dto.amount,
        status: 'PENDING',
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

      // Simulate/Trigger contract call
      // In a real environment, we'd sign with the backend's key (acting as spender)
      // For this test/integration proxy we'll construct the transaction and submit if a key is provided.
      const secret = process.env.STELLAR_SECRET_KEY;
      if (secret) {
        const keypair = StellarSdk.Keypair.fromSecret(secret);
        const sourceAccount = await this.rpcServer.getAccount(
          keypair.publicKey(),
        );

        const contract = new StellarSdk.Contract(contractId);
        const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
          fee: '1000',
          networkPassphrase: this.networkPassphrase,
        })
          .addOperation(
            contract.call(
              'transfer_from',
              nativeToScVal(keypair.publicKey(), { type: 'address' }),
              nativeToScVal(fromAddress, { type: 'address' }),
              nativeToScVal(toAddress, { type: 'address' }),
              nativeToScVal(amount, { type: 'i128' }),
            ),
          )
          .setTimeout(30)
          .build();

        tx.sign(keypair);

        const response = await this.rpcServer.sendTransaction(tx);

        if (response.status === 'ERROR') {
          throw new Error(`Stellar RPC Error: ${JSON.stringify(response)}`);
        }

        const hash = response.hash;

        const prisma = this.prisma as any;
        await prisma.creditTransfer.update({
          where: { id: transferId },
          data: {
            transactionHash: hash,
            status: 'CONFIRMED',
            confirmedAt: new Date(),
          },
        });
      } else {
        // Mock successful transaction if no secret key provided
        this.logger.warn(
          `No STELLAR_SECRET_KEY provided, simulating successful transfer for ${transferId}`,
        );
        const mockHash = `simulated_tx_${Date.now()}`;
        const prisma = this.prisma as any;
        await prisma.creditTransfer.update({
          where: { id: transferId },
          data: {
            transactionHash: mockHash,
            status: 'CONFIRMED',
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
            status: 'FAILED',
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  }
}
