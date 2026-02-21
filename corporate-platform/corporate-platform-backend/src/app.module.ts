import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RetirementModule } from './retirement/retirement.module';
import { ComplianceModule } from './compliance/compliance.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { StellarModule } from './stellar/stellar.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CacheModule } from './cache/cache.module';
import { DatabaseModule } from './shared/database/database.module';
import { AuthModule } from './auth/auth.module';

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
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
