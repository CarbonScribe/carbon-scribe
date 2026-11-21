import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class IdempotencyCleanupService {
  private readonly logger = new Logger(IdempotencyCleanupService.name);

  constructor(private readonly idempotencyService: IdempotencyService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanup(): Promise<number> {
    this.logger.log('Running idempotency records cleanup...');
    const deletedCount = await this.idempotencyService.cleanupExpired();
    this.logger.log(`Cleaned up ${deletedCount} expired idempotency records.`);
    return deletedCount;
  }
}
