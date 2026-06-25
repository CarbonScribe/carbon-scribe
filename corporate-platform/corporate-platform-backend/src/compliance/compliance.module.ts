import { Module } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { ComplianceController } from './compliance.controller';
import { SecurityModule } from '../security/security.module';
import { SorobanModule } from '../stellar/soroban/soroban.module';
import { RetirementVerificationService } from './services/retirement-verification.service';
import { RetirementHistoryService } from './retirement-history/retirement-history.service';
import { RetirementHistoryController } from './retirement-history/retirement-history.controller';

@Module({
  imports: [SecurityModule, SorobanModule],
  providers: [
    ComplianceService,
    RetirementVerificationService,
    RetirementHistoryService,
  ],
  controllers: [ComplianceController, RetirementHistoryController],
  exports: [
    ComplianceService,
    RetirementVerificationService,
    RetirementHistoryService,
  ],
})
export class ComplianceModule {}
