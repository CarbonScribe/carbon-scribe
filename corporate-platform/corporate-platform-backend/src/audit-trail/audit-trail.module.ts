import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { StellarModule } from '../stellar/stellar.module';
import { DatabaseModule } from '../shared/database/database.module';
import { AuditTrailController } from './audit-trail.controller';
import { AuditTrailService } from './audit-trail.service';
import { BlockchainAnchorService } from './services/blockchain-anchor.service';
import { EventLoggerService } from './services/event-logger.service';
import { IntegrityVerifierService } from './services/integrity-verifier.service';
import { RetentionManagerService } from './services/retention-manager.service';
import { ComplianceAuditMiddleware } from './middleware/compliance-audit.middleware';

@Module({
  imports: [DatabaseModule, StellarModule],
  providers: [
    AuditTrailService,
    EventLoggerService,
    IntegrityVerifierService,
    BlockchainAnchorService,
    RetentionManagerService,
  ],
  controllers: [AuditTrailController],
  exports: [AuditTrailService, EventLoggerService],
})
export class AuditTrailModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ComplianceAuditMiddleware).forRoutes('*');
  }
}
