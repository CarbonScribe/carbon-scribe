import { Module } from '@nestjs/common';
import { MethodologyMappingService } from './services/methodology-mapping.service';
import { MappingRulesService } from './services/mapping-rules.service';
import { CrossComplianceService } from './services/cross-compliance.service';
import { MethodologyMappingController } from './controllers/methodology-mapping.controller';
import { AutoMappingJob } from './jobs/auto-mapping.job';
import { DatabaseModule } from '../shared/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [MethodologyMappingController],
  providers: [
    MethodologyMappingService,
    MappingRulesService,
    CrossComplianceService,
    AutoMappingJob,
  ],
  exports: [
    MethodologyMappingService,
    MappingRulesService,
    CrossComplianceService,
  ],
})
export class FrameworkRegistryModule {}
