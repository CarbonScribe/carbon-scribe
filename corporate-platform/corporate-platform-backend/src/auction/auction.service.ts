import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';
import { DutchAuctionService } from './services/dutch-auction.service';
import { BidProcessorService } from './services/bid-processor.service';
import { SettlementService } from './services/settlement.service';

@Injectable()
export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dutchAuctionService: DutchAuctionService,
    private readonly bidProcessorService: BidProcessorService,
    private readonly settlementService: SettlementService,
  ) {}

  async createAuction(dto: CreateAuctionDto) {
    const auction = await this.prisma.auction.create({
      data: {
        creditId: dto.creditId,
        quantity: dto.quantity,
        remaining: dto.quantity,
        startPrice: dto.startPrice,
        currentPrice: dto.startPrice,
        floorPrice: dto.floorPrice,
        priceDecrement: dto.priceDecrement,
        decrementInterval: dto.decrementInterval,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        lastPriceUpdate: new Date(),
        status: 'pending',
      },
    });

    this.logger.log(`Auction ${auction.id} created successfully`);
    return auction;
  }

  async getAuctions() {
    return this.prisma.auction.findMany({
      include: { credit: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAuctionById(id: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id },
      include: { credit: true, bids: true },
    });

    if (!auction) {
      throw new NotFoundException(`Auction ${id} not found`);
    }

    // update current price for response dynamically without hitting DB to save writes
    const currentPrice =
      this.dutchAuctionService.calculateCurrentPrice(auction);
    return { ...auction, currentPrice };
  }

  async startAuction(id: string) {
    return this.prisma.auction.update({
      where: { id },
      data: { status: 'active', startTime: new Date() },
    });
  }

  async placeBid(
    auctionId: string,
    userId: string,
    companyId: string,
    dto: PlaceBidDto,
  ) {
    return this.bidProcessorService.processBid(
      auctionId,
      userId,
      companyId,
      dto,
    );
  }

  async getAuctionBids(auctionId: string) {
    return this.prisma.bid.findMany({
      where: { auctionId },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
  }

  async settleAuction(auctionId: string) {
    return this.settlementService.settleAuction(auctionId);
  }
}
