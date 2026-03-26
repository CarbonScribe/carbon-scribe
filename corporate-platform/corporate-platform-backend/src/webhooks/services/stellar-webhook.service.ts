import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  StellarWebhookDto,
  TransactionStatusResponseDto,
} from '../dto/stellar-webhook.dto';
import { TransactionStatus } from '../interfaces/webhook.interface';

@Injectable()
export class StellarWebhookService {
  private readonly logger = new Logger(StellarWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerTransaction(dto: StellarWebhookDto) {
    this.logger.log(
      `Registering transaction confirmation for hash: ${dto.transactionHash}`,
    );

    return this.prisma.transactionConfirmation.upsert({
      where: { transactionHash: dto.transactionHash },
      update: {
        status: dto.status,
        ledgerSequence: dto.ledgerSequence,
        metadata: dto.metadata,
      },
      create: {
        transactionHash: dto.transactionHash,
        companyId: dto.companyId,
        operationType: dto.operationType,
        status: dto.status,
        metadata: dto.metadata,
        ledgerSequence: dto.ledgerSequence,
      },
    });
  }

  async updateTransactionStatus(
    hash: string,
    status: TransactionStatus,
    ledger?: number,
  ) {
    const confirmation = await this.prisma.transactionConfirmation.findUnique({
      where: { transactionHash: hash },
    });

    if (!confirmation) {
      this.logger.warn(
        `Attempted to update status for unknown transaction: ${hash}`,
      );
      return null;
    }

    return this.prisma.transactionConfirmation.update({
      where: { transactionHash: hash },
      data: {
        status,
        confirmations: { increment: 1 },
        ledgerSequence: ledger,
        finalizedAt: status === TransactionStatus.CONFIRMED ? new Date() : null,
      },
    });
  }

  async getTransactionStatus(
    hash: string,
  ): Promise<TransactionStatusResponseDto> {
    const confirmation = await this.prisma.transactionConfirmation.findUnique({
      where: { transactionHash: hash },
    });

    if (!confirmation) {
      throw new NotFoundException(`Transaction with hash ${hash} not found`);
    }

    return {
      transactionHash: confirmation.transactionHash,
      status: confirmation.status as TransactionStatus,
      confirmations: confirmation.confirmations,
      finalizedAt: confirmation.finalizedAt,
    };
  }

  async listDeliveries() {
    return this.prisma.webhookDelivery.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
