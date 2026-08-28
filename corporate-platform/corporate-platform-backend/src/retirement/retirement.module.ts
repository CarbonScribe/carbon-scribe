import { Module } from '@nestjs/common';
import { RetirementService } from './retirement.service';
import { RetirementController } from './retirement.controller';
import { InstantRetirementService } from './services/instant-retirement.service';
import { ValidationService } from './services/validation.service';
import { CertificateService } from './services/certificate.service';
import { HistoryService } from './services/history.service';
import { PostPurchaseService } from './services/post-purchase.service';
import { SecurityModule } from '../security/security.module';
import { StellarModule } from '../stellar/stellar.module';
import { SorobanModule } from '../stellar/soroban/soroban.module';
import { RetirementRecordingService } from './retirement-recording/retirement-recording.service';
import { RetirementRecordingController } from './retirement-recording/retirement-recording.controller';
import { RetirementEventListener } from '../stellar/soroban/events/retirement-event.listener';
import { IdempotencyKeyService } from './idempotency/idempotency-key.service';
import { IdempotencyInterceptor } from './idempotency/idempotency.interceptor';
import { CacheModule } from '../cache/cache.module';
import { DatabaseModule } from '../shared/database/database.module';
import { CreditModule } from '../credit/credit.module';

@Module({
  imports: [
    SecurityModule,
    StellarModule,
    SorobanModule,
    CacheModule,
    DatabaseModule,
    CreditModule,
  ],
  providers: [
    RetirementService,
    InstantRetirementService,
    ValidationService,
    CertificateService,
    HistoryService,
    PostPurchaseService,
    RetirementRecordingService,
    RetirementEventListener,
    IdempotencyKeyService,
    IdempotencyInterceptor,
  ],
  controllers: [RetirementController, RetirementRecordingController],
  exports: [
    RetirementService,
    InstantRetirementService,
    ValidationService,
    CertificateService,
    PostPurchaseService,
    RetirementRecordingService,
    IdempotencyKeyService,
  ],
})
export class RetirementModule {}
