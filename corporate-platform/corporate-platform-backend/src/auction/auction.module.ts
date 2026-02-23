import { Module } from '@nestjs/common';
import { AuctionController } from './auction.controller';
import { AuctionService } from './auction.service';
import { DutchAuctionService } from './services/dutch-auction.service';
import { BidProcessorService } from './services/bid-processor.service';
import { SettlementService } from './services/settlement.service';
import { PrismaService } from '../shared/database/prisma.service';

@Module({
  controllers: [AuctionController],
  providers: [
    AuctionService,
    DutchAuctionService,
    BidProcessorService,
    SettlementService,
    PrismaService, // Should ideally be exported by a SharedModule
  ],
  exports: [AuctionService],
})
export class AuctionModule {}
