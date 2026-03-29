import { Module } from '@nestjs/common';
import { MethodologyMappingService } from './services/methodology-mapping.service';
import { MappingRulesService } from './services/mapping-rules.service';
import { CrossComplianceService } from './services/cross-compliance.service';
import { MethodologyMappingController } from './controllers/methodology-mapping.controller';
import { MethodologySyncController } from './controllers/methodology-sync.controller';
import { AutoMappingJob } from './jobs/auto-mapping.job';
import { MethodologySyncJob } from './jobs/methodology-sync.job';
import { DatabaseModule } from '../shared/database/database.module';
import { StellarModule } from '../stellar/stellar.module';
import { MethodologySyncService } from './services/methodology-sync.service';
import { MethodologyMapperService } from './services/methodology-mapper.service';

@Module({
  imports: [DatabaseModule, StellarModule],
  controllers: [MethodologyMappingController, MethodologySyncController],
  providers: [
    MethodologyMappingService,
    MethodologySyncService,
    MethodologyMapperService,
    MappingRulesService,
    CrossComplianceService,
    AutoMappingJob,
    MethodologySyncJob,
  ],
  exports: [
    MethodologyMappingService,
    MethodologySyncService,
    MethodologyMapperService,
    MappingRulesService,
    CrossComplianceService,
  ],
})
export class FrameworkRegistryModule {}
