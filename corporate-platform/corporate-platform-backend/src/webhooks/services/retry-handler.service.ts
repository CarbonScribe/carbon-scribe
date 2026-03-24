import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../shared/database/prisma.service';
import { WebhookStatus } from '../interfaces/webhook.interface';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class RetryHandlerService {
  private readonly logger = new Logger(RetryHandlerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleRetries() {
    const maxAttempts = parseInt(process.env.WEBHOOK_RETRY_MAX_ATTEMPTS || '5');
    const delayMs = parseInt(process.env.WEBHOOK_RETRY_DELAY_MS || '5000');
    const multiplier = parseInt(
      process.env.WEBHOOK_RETRY_BACKOFF_MULTIPLIER || '2',
    );

    const retriableDeliveries = await this.prisma.webhookDelivery.findMany({
      where: {
        status: { in: [WebhookStatus.FAILED, WebhookStatus.RETRYING] },
        retryCount: { lt: maxAttempts },
        nextAttemptAt: { lte: new Date() },
      },
    });

    if (retriableDeliveries.length === 0) return;

    this.logger.log(
      `Processing ${retriableDeliveries.length} retriable webhook deliveries`,
    );

    for (const delivery of retriableDeliveries) {
      await this.retryDelivery(delivery, delayMs, multiplier);
    }
  }

  private async retryDelivery(
    delivery: any,
    baseDelay: number,
    multiplier: number,
  ) {
    const nextRetryCount = delivery.retryCount + 1;
    const nextDelay = baseDelay * Math.pow(multiplier, nextRetryCount - 1);
    const nextAttemptAt = new Date(Date.now() + nextDelay);

    try {
      // In a real implementation, this would call the actual webhook URL
      // For this task, we're just updating the status to simulate a retry
      this.logger.log(
        `Retrying delivery ${delivery.id} (attempt ${nextRetryCount})`,
      );

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: WebhookStatus.RETRYING,
          retryCount: nextRetryCount,
          lastAttemptAt: new Date(),
          nextAttemptAt,
        },
      });

      // Simulate successful delivery for demo purposes
      // await this.markAsDelivered(delivery.id);
    } catch (error) {
      this.logger.error(
        `Failed to retry delivery ${delivery.id}: ${error.message}`,
      );
    }
  }

  async markAsDelivered(id: string) {
    await this.prisma.webhookDelivery.update({
      where: { id },
      data: {
        status: WebhookStatus.DELIVERED,
        deliveredAt: new Date(),
      },
    });
  }

  async recordFailure(eventType: string, payload: any, error: string) {
    await this.prisma.webhookDelivery.create({
      data: {
        eventType,
        payload,
        status: WebhookStatus.FAILED,
        errorMessage: error,
        lastAttemptAt: new Date(),
        nextAttemptAt: new Date(Date.now() + 5000), // Initial retry in 5s
      },
    });
  }
}
