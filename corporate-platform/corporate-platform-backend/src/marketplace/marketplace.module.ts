import { Module } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceController } from './marketplace.controller';
import { DatabaseModule } from '../shared/database/database.module';
import { CacheModule } from '../cache/cache.module';
import { SearchService } from './services/search.service';
import { RecommendationService } from './services/recommendation.service';
import { DiscoveryService } from './services/discovery.service';
import { StatsService } from './services/stats.service';

@Module({
  imports: [DatabaseModule, CacheModule],
  providers: [
    MarketplaceService,
    SearchService,
    RecommendationService,
    DiscoveryService,
    StatsService,
  ],
  controllers: [MarketplaceController],
})
export class MarketplaceModule {}
