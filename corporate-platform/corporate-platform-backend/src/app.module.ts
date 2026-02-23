import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './shared/database/database.module';
import { RetirementModule } from './retirement/retirement.module';
import { ComplianceModule } from './compliance/compliance.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { StellarModule } from './stellar/stellar.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CacheModule } from './cache/cache.module';
import { RetirementAnalyticsModule } from './retirement-analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { RbacModule } from './rbac/rbac.module';
import { AuctionModule } from './auction/auction.module';
import { SchedulingModule } from './retirement-scheduling/scheduling.module';

@Module({
  imports: [
    DatabaseModule,
    RetirementModule,
    ComplianceModule,
    MarketplaceModule,
    StellarModule,
    WebhooksModule,
    AnalyticsModule,
    CacheModule,
    RetirementAnalyticsModule,
    AuthModule,
    CartModule,
    RbacModule,
    AuctionModule,
    SchedulingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
