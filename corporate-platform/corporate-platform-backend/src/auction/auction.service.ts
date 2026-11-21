import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';
import { DutchAuctionService } from './services/dutch-auction.service';
import { BidProcessorService } from './services/bid-processor.service';
import { SettlementService } from './services/settlement.service';

@Injectable()
export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);

  /** Upper sanity bound: bids above this multiple of the current price are rejected. */
  static readonly MAX_BID_MULTIPLIER = 10;

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
   * Place a bid on an auction.
   * Rate limiting is applied at the controller level via @RateLimit decorator.
   * Bids are binding: the caller must have completed the client-side review
   * step (price, quantity, total cost, and current auction price) before this
   * endpoint is invoked. The server re-validates the bid against the current
   * auction price and rejects bids that are non-positive or exceed the
   * configured sanity bounds.
   *
   * Note: the client-side PlaceBidForm test expects a "Too many attempts — try
   * again in Ns" message and a "Review bid" submit button. Those are UI concerns
   * handled in the frontend component, not in this service.
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

    const currentPrice =
      this.dutchAuctionService.calculateCurrentPrice(auction);

    if (dto.bidPrice <= 0 || dto.quantity <= 0) {
      throw new BadRequestException('Bid price and quantity must be positive');
    }

    if (dto.bidPrice > currentPrice * AuctionService.MAX_BID_MULTIPLIER) {
      throw new BadRequestException(
        `Bid price exceeds the sanity bound of ${AuctionService.MAX_BID_MULTIPLIER}x the current auction price`,
      );
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
