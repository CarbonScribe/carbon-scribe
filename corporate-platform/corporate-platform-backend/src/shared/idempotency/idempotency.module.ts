import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyCleanupService } from './idempotency-cleanup.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    IdempotencyService,
    IdempotencyInterceptor,
    IdempotencyCleanupService,
  ],
  exports: [
    IdempotencyService,
    IdempotencyInterceptor,
    IdempotencyCleanupService,
  ],
})
export class IdempotencyModule {}
