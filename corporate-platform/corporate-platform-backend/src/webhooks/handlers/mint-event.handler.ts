import { Injectable, Logger } from '@nestjs/common';
import { IWebhookHandler } from '../interfaces/webhook.interface';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class MintEventHandler implements IWebhookHandler {
  private readonly logger = new Logger(MintEventHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  supports(eventType: string): boolean {
    return eventType === 'contract.mint';
  }

  async handle(payload: any): Promise<void> {
    this.logger.log(`Handling mint event from contract: ${payload.contractId}`);

    // In a real implementation, we would update the Credit inventory
    // For now, we'll just log it
    this.logger.log(
      `New credits minted in contract ${payload.contractId}, ledger ${payload.ledger}`,
    );
  }
}
