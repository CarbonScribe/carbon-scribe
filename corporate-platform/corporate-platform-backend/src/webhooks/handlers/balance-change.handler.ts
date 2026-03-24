import { Injectable, Logger } from '@nestjs/common';
import { IWebhookHandler } from '../interfaces/webhook.interface';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class BalanceChangeHandler implements IWebhookHandler {
  private readonly logger = new Logger(BalanceChangeHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  supports(eventType: string): boolean {
    return eventType === 'account.updated';
  }

  async handle(payload: any): Promise<void> {
    this.logger.log(
      `Handling account balance update for: ${payload.accountId}`,
    );

    // In a real implementation, we would update the Portfolio balance
    // For now, we'll just log it
    this.logger.log(
      `Account ${payload.accountId} balance updated on ledger ${payload.ledger}`,
    );
  }
}
