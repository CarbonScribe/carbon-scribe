import { Module } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceController } from './marketplace.controller';

@Module({
  providers: [MarketplaceService],
  controllers: [MarketplaceController],
})
export class MarketplaceModule {}
