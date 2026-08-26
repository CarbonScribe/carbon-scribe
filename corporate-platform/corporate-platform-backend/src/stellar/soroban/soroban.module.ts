import { Module } from '@nestjs/common';
import { SorobanService } from './soroban.service';
import { CarbonAssetService } from './contracts/carbon-asset.service';
import { RetirementTrackerService } from './contracts/retirement-tracker.service';
import { MethodologyLibraryService } from './contracts/methodology-library.service';
import { RetirementVerificationService } from './verification/retirement-verification.service';
import { ProofGeneratorService } from './verification/proof-generator.service';
import { TransactionHistoryService } from './history/transaction-history.service';
import { EventListenerService } from './history/event-listener.service';
import { ContractAuthGuard } from './guards/contract-auth.guard';
import { OwnershipEventListener } from './events/ownership-event.listener';
import { OwnershipHistoryModule } from '../../audit/ownership-history/ownership-history.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { IdempotencyService } from './idempotency/idempotency.service';

import { ConfigModule } from '../../config/config.module';

@Module({
  imports: [OwnershipHistoryModule, IdempotencyModule, ConfigModule],
  providers: [
    SorobanService,
    CarbonAssetService,
    RetirementTrackerService,
    MethodologyLibraryService,
    RetirementVerificationService,
    ProofGeneratorService,
    TransactionHistoryService,
    EventListenerService,
    ContractAuthGuard,
    OwnershipEventListener,
    IdempotencyService, // Add this explicitly
  ],
  exports: [
    SorobanService,
    CarbonAssetService,
    RetirementTrackerService,
    MethodologyLibraryService,
    RetirementVerificationService,
    ProofGeneratorService,
    TransactionHistoryService,
    EventListenerService,
    ContractAuthGuard,
    OwnershipEventListener,
    IdempotencyService,
  ],
})
export class SorobanModule {}
