import { Module } from '@nestjs/common';
import { CbamController } from './cbam.controller';
import { CbamService } from './cbam.service';
import { GoodsClassificationService } from './services/goods-classification.service';
import { EmbeddedEmissionsService } from './services/embedded-emissions.service';
import { QuarterlyReportService } from './services/quarterly-report.service';
import { CertificateTrackingService } from './services/certificate-tracking.service';
import { DatabaseModule } from '../shared/database/database.module';
import { SecurityModule } from '../security/security.module';
import { FrameworkRegistryModule } from '../framework-registry/framework-registry.module';

@Module({
  imports: [DatabaseModule, SecurityModule, FrameworkRegistryModule],
  controllers: [CbamController],
  providers: [
    CbamService,
    GoodsClassificationService,
    EmbeddedEmissionsService,
    QuarterlyReportService,
    CertificateTrackingService,
  ],
  exports: [CbamService],
})
export class CbamModule {}
