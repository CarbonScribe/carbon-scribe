import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { StellarModule } from '../stellar/stellar.module';
import { DatabaseModule } from '../shared/database/database.module';
import { AuditTrailController } from './audit-trail.controller';
import { AuditController } from './audit.controller';
import { AuditTrailService } from './audit-trail.service';
import { BlockchainAnchorService } from './services/blockchain-anchor.service';
import { EventLoggerService } from './services/event-logger.service';
import { IntegrityVerifierService } from './services/integrity-verifier.service';
import { RetentionManagerService } from './services/retention-manager.service';
import { RetirementAuditHashService } from './services/retirement-audit-hash.service';
import { ComplianceAuditMiddleware } from './middleware/compliance-audit.middleware';
import { AuditRateLimitMiddleware } from './middleware/audit-rate-limit.middleware';

@Module({
  imports: [DatabaseModule, StellarModule],
  providers: [
    AuditTrailService,
    EventLoggerService,
    IntegrityVerifierService,
    BlockchainAnchorService,
    RetentionManagerService,
    RetirementAuditHashService,
  ],
  controllers: [AuditTrailController, AuditController],
  exports: [AuditTrailService, EventLoggerService, RetirementAuditHashService],
})
export class AuditTrailModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Existing compliance capture middleware (all non-audit-trail mutation routes)
    consumer.apply(ComplianceAuditMiddleware).forRoutes('*');

    // Rate limiting on audit hash anchoring and verification endpoints
    consumer
      .apply(AuditRateLimitMiddleware)
      .forRoutes(
        { path: 'api/v1/audit/anchor-hash', method: RequestMethod.POST },
        { path: 'api/v1/audit/verify-hash/:tokenId', method: RequestMethod.GET },
      );
  }
}

