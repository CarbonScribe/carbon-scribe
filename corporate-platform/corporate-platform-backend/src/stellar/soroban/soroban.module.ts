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

@Module({
  imports: [OwnershipHistoryModule],
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
  ],
})
export class SorobanModule {}
