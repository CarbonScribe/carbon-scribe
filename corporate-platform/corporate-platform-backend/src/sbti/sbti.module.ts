import { AuditTrailModule } from '../audit-trail/audit-trail.module';
import { Module } from '@nestjs/common';
import { SbtiService } from './sbti.service';
import { SbtiController } from './sbti.controller';
import { TargetValidationService } from './services/target-validation.service';
import { ProgressTrackingService } from './services/progress-tracking.service';
import { SubmissionService } from './services/submission.service';
import { RetirementService } from '../retirement/retirement.service';
import { GhgProtocolModule } from '../ghg-protocol/ghg-protocol.module';

import { PrismaService } from '../shared/database/prisma.service';

@Module({
  imports: [GhgProtocolModule, AuditTrailModule],
  controllers: [SbtiController],
  providers: [
    SbtiService,
    TargetValidationService,
    ProgressTrackingService,
    SubmissionService,
    PrismaService,
    RetirementService,
  ],
})
export class SbtiModule {}
