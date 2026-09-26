import { Module } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { IdempotencyService } from './idempotency.service';

@Module({
  providers: [IdempotencyService, PrismaService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
