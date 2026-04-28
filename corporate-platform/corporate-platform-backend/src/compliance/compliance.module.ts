import { Module } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { ComplianceController } from './compliance.controller';
import { SecurityModule } from '../security/security.module';
import { SorobanModule } from '../stellar/soroban/soroban.module';
import { RetirementVerificationService } from './services/retirement-verification.service';

@Module({
  imports: [SecurityModule, SorobanModule],
  providers: [ComplianceService, RetirementVerificationService],
  controllers: [ComplianceController],
  exports: [ComplianceService, RetirementVerificationService],
})
export class ComplianceModule {}
