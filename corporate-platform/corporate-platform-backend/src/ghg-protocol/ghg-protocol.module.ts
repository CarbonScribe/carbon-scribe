import { Module } from '@nestjs/common';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';
import { FrameworkRegistryModule } from '../framework-registry/framework-registry.module';
import { SecurityModule } from '../security/security.module';
import { DatabaseModule } from '../shared/database/database.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { GhgProtocolController } from './ghg-protocol.controller';
import { GhgProtocolService } from './ghg-protocol.service';
import { EmissionFactorsService } from './services/emission-factors.service';
import { InventoryService } from './services/inventory.service';
import { Scope1Service } from './services/scope1.service';
import { Scope2Service } from './services/scope2.service';
import { Scope3Service } from './services/scope3.service';

@Module({
  imports: [
    DatabaseModule,
    FrameworkRegistryModule,
    AuditTrailModule,
    SecurityModule,
    ComplianceModule,
  ],
  controllers: [GhgProtocolController],
  providers: [
    GhgProtocolService,
    Scope1Service,
    Scope2Service,
    Scope3Service,
    EmissionFactorsService,
    InventoryService,
  ],
  exports: [GhgProtocolService],
})
export class GhgProtocolModule {}
