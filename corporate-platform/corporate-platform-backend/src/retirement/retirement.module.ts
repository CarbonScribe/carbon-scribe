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

@Module({
  imports: [SecurityModule, StellarModule],
  providers: [
    RetirementService,
    InstantRetirementService,
    ValidationService,
    CertificateService,
    HistoryService,
    PostPurchaseService,
  ],
  controllers: [RetirementController],
  exports: [
    RetirementService,
    InstantRetirementService,
    ValidationService,
    CertificateService,
    PostPurchaseService,
  ],
})
export class RetirementModule {}
