import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { PlaceBidDto } from '../dto/place-bid.dto';
import { DutchAuctionService } from './dutch-auction.service';

@Injectable()
export class BidProcessorService {
  private readonly logger = new Logger(BidProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dutchAuctionService: DutchAuctionService,
  ) {}

  async processBid(
    auctionId: string,
    userId: string,
    companyId: string,
    dto: PlaceBidDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch auction with row-level lock
      const auction = await tx.auction.findUnique({
        where: { id: auctionId },
      });

      if (!auction) {
        throw new BadRequestException('Auction not found');
      }

      if (auction.status !== 'active') {
        throw new BadRequestException(`Auction is ${auction.status}`);
      }

      // 2. Validate quantity
      if (dto.quantity > auction.remaining) {
        throw new BadRequestException(
          `Requested quantity ${dto.quantity} exceeds available ${auction.remaining}`,
        );
      }

      // 3. Validate price
      const currentPrice =
        this.dutchAuctionService.calculateCurrentPrice(auction);
      if (dto.bidPrice < currentPrice) {
        throw new BadRequestException(
          `Bid price ${dto.bidPrice} is lower than current price ${currentPrice}`,
        );
      }

      // 4. Create bid and update auction remaining amount
      const bid = await tx.bid.create({
        data: {
          auctionId,
          userId,
          companyId,
          bidPrice: dto.bidPrice,
          quantity: dto.quantity,
          status: 'accepted',
        },
      });

      const newRemaining = auction.remaining - dto.quantity;
      const newStatus = newRemaining === 0 ? 'ended' : auction.status;

      await tx.auction.update({
        where: { id: auctionId },
        data: {
          remaining: newRemaining,
          status: newStatus,
        },
      });

      this.logger.log(
        `Bid accepted for auction ${auctionId} by user ${userId}`,
      );

      return bid;
    });
  }
}
