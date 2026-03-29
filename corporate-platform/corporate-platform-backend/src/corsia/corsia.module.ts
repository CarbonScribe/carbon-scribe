import { Module } from '@nestjs/common';
import { CorsiaService } from './corsia.service';
import { CorsiaController } from './corsia.controller';
import { FlightEmissionsService } from './services/flight-emissions.service';
import { OffsetRequirementService } from './services/offset-requirement.service';
import { EmissionsReportService } from './services/emissions-report.service';
import { EligibleFuelsService } from './services/eligible-fuels.service';
import { VerifierService } from './services/verifier.service';
import { FrameworkRegistryModule } from '../framework-registry/framework-registry.module';
import { RetirementModule } from '../retirement/retirement.module';
import { DatabaseModule } from '../shared/database/database.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    FrameworkRegistryModule,
    RetirementModule,
    DatabaseModule,
    SecurityModule,
  ],
  controllers: [CorsiaController],
  providers: [
    CorsiaService,
    FlightEmissionsService,
    OffsetRequirementService,
    EmissionsReportService,
    EligibleFuelsService,
    VerifierService,
  ],
  exports: [CorsiaService],
})
export class CorsiaModule {}
