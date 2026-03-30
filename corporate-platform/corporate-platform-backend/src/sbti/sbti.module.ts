import { Module } from '@nestjs/common';
import { SbtiController } from './sbti.controller';
import { SbtiService } from './sbti.service';
import { TargetValidationService } from './services/target-validation.service';
import { ProgressTrackingService } from './services/progress-tracking.service';
import { SubmissionService } from './services/submission.service';
import { DatabaseModule } from '../shared/database/database.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [DatabaseModule, SecurityModule],
  controllers: [SbtiController],
  providers: [
    SbtiService,
    TargetValidationService,
    ProgressTrackingService,
    SubmissionService,
  ],
  exports: [SbtiService],
})
export class SbtiModule {}
