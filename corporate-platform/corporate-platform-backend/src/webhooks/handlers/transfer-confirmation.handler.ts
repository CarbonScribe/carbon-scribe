import { Injectable, Logger } from '@nestjs/common';
import {
  IWebhookHandler,
  OperationType,
} from '../interfaces/webhook.interface';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class TransferConfirmationHandler implements IWebhookHandler {
  private readonly logger = new Logger(TransferConfirmationHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  supports(eventType: string): boolean {
    return (
      eventType === 'transaction.confirmed' ||
      eventType === 'transaction.failed'
    );
  }

  async handle(payload: any): Promise<void> {
    if (payload.operationType !== OperationType.TRANSFER) return;

    this.logger.log(`Handling transfer confirmation for hash: ${payload.hash}`);

    // In a real implementation, we would update the Transfer record status
    // For now, we'll just log it
    this.logger.log(
      `Transfer for hash ${payload.hash} is now ${payload.eventType}`,
    );
  }
}
