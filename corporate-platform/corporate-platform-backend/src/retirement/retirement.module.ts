import { Module } from '@nestjs/common';
import { RetirementService } from './retirement.service';
import { RetirementController } from './retirement.controller';
import { InstantRetirementService } from './services/instant-retirement.service';
import { ValidationService } from './services/validation.service';
import { CertificateService } from './services/certificate.service';
import { HistoryService } from './services/history.service';

@Module({
  providers: [
    RetirementService,
    InstantRetirementService,
    ValidationService,
    CertificateService,
    HistoryService,
  ],
  controllers: [RetirementController],
  exports: [RetirementService],
})
export class RetirementModule {}
