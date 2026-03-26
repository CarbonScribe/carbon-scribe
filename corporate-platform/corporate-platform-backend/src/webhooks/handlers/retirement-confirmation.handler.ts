import { Injectable, Logger } from '@nestjs/common';
import {
  IWebhookHandler,
  OperationType,
} from '../interfaces/webhook.interface';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class RetirementConfirmationHandler implements IWebhookHandler {
  private readonly logger = new Logger(RetirementConfirmationHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  supports(eventType: string): boolean {
    return (
      eventType === 'transaction.confirmed' ||
      eventType === 'transaction.failed'
    );
  }

  async handle(payload: any): Promise<void> {
    if (payload.operationType !== OperationType.RETIREMENT) return;

    this.logger.log(
      `Handling retirement confirmation for hash: ${payload.hash}`,
    );

    const isConfirmed = payload.eventType === 'transaction.confirmed';

    try {
      // 1. Find the retirement record associated with this hash
      const retirement = await this.prisma.retirement.findFirst({
        where: { transactionHash: payload.hash },
      });

      if (retirement) {
        // 2. Update retirement verification status
        await this.prisma.retirement.update({
          where: { id: retirement.id },
          data: {
            verifiedAt: isConfirmed ? new Date() : null,
          },
        });

        this.logger.log(
          `Retirement ${retirement.id} status updated based on blockchain confirmation`,
        );

        // 3. Trigger certificate generation if confirmed
        if (isConfirmed) {
          this.logger.log(
            `Triggering certificate generation for retirement: ${retirement.id}`,
          );
          // this.certificateService.generate(retirement.id);
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle retirement confirmation: ${error.message}`,
      );
    }
  }
}
