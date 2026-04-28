import { Module } from '@nestjs/common';
import { CsrdService } from './csrd.service';
import { CsrdController } from './csrd.controller';
import { MaterialityAssessmentService } from './services/materiality-assessment.service';
import { EsrsDisclosureService } from './services/esrs-disclosure.service';
import { ReportGeneratorService } from './services/report-generator.service';
import { AssuranceService } from './services/assurance.service';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { DatabaseModule } from '../shared/database/database.module';
import { FrameworkRegistryModule } from '../framework-registry/framework-registry.module';
import { GhgProtocolModule } from '../ghg-protocol/ghg-protocol.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    DatabaseModule,
    FrameworkRegistryModule,
    AuditTrailModule,
    GhgProtocolModule,
    SecurityModule,
    ComplianceModule,
  ],
  controllers: [CsrdController],
  providers: [
    CsrdService,
    MaterialityAssessmentService,
    EsrsDisclosureService,
    ReportGeneratorService,
    AssuranceService,
  ],
  exports: [CsrdService],
})
export class CsrdModule {}
