import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RetirementModule } from './retirement/retirement.module';
import { ComplianceModule } from './compliance/compliance.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { StellarModule } from './stellar/stellar.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CacheModule } from './cache/cache.module';
import { AuthModule } from './auth/auth.module';
import { AuctionModule } from './auction/auction.module';
import { ConfigModule } from './config/config.module';
import { LoggerModule } from './logger/logger.module';
import { RequestLoggerMiddleware } from './logger/middleware/request-logger.middleware';
import { SecurityModule } from './security/security.module';
import { ApiKeyModule } from './api-key/api-key.module';
@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    SecurityModule,
    RetirementModule,
    ComplianceModule,
    MarketplaceModule,
    StellarModule,
    WebhooksModule,
    AnalyticsModule,
    CacheModule,
    AuthModule,
    AuctionModule,
    ApiKeyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
