import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';
import { DutchAuctionService } from './services/dutch-auction.service';
import { BidProcessorService } from './services/bid-processor.service';
import { SettlementService } from './services/settlement.service';

/**
 * Server-side anti-fat-finger guard thresholds.
 * A bid whose price exceeds the current auction price by more than this
 * ratio, or whose total cost exceeds the max total, must be explicitly
 * acknowledged by the client (`acknowledgeHighBid: true`).
 */
export const HIGH_BID_PREMIUM_RATIO = 0.25;
export const HIGH_BID_TOTAL_THRESHOLD = 1_000_000;

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

  /**
   * Place a bid on an auction
   * Rate limiting is applied at the controller level via @RateLimit decorator
   *
   * Anti-fat-finger guard: bids that are far above the current auction price
   * or have a very large total cost are rejected unless the client explicitly
   * acknowledges them via `acknowledgeHighBid`.
   */
  async placeBid(
    auctionId: string,
    userId: string,
    companyId: string,
    dto: PlaceBidDto,
  ) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
    });

    if (!auction) {
      throw new NotFoundException(`Auction ${auctionId} not found`);
    }

    const currentPrice = Number(
      this.dutchAuctionService.calculateCurrentPrice(auction),
    );
    const bidPrice = Number((dto as any).bidPrice);
    const quantity = Number((dto as any).quantity);
    const totalCost = bidPrice * quantity;

    const premiumRatio =
      currentPrice > 0 ? (bidPrice - currentPrice) / currentPrice : 0;
    const isHighPremium = premiumRatio > HIGH_BID_PREMIUM_RATIO;
    const isHighTotal = totalCost > HIGH_BID_TOTAL_THRESHOLD;

    if ((isHighPremium || isHighTotal) && !(dto as any).acknowledgeHighBid) {
      this.logger.warn(
        `Bid on auction ${auctionId} by user ${userId} rejected: requires acknowledgement ` +
          `(premium=${(premiumRatio * 100).toFixed(2)}%, total=${totalCost})`,
      );
      throw new BadRequestException({
        message:
          'Bid requires explicit acknowledgement: price is significantly above the current auction price or total cost exceeds the allowed threshold',
        code: 'HIGH_BID_REQUIRES_ACKNOWLEDGEMENT',
        currentPrice,
        bidPrice,
        totalCost,
        premiumRatio,
      });
    }

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
