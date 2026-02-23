import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(private readonly prisma: PrismaService) {}

  async settleAuction(auctionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const auction = await tx.auction.findUnique({
        where: { id: auctionId },
        include: {
          bids: {
            where: { status: 'accepted' },
          },
        },
      });

      if (!auction) {
        throw new BadRequestException('Auction not found');
      }

      if (auction.status === 'settled') {
        throw new BadRequestException('Auction is already settled');
      }

      if (auction.status === 'active') {
        throw new BadRequestException('Cannot settle an active auction');
      }

      // Mocking Cart & Checkout Service Integration
      this.logger.log(
        `Initiating checkout process for ${auction.bids.length} winning bids`,
      );

      // Mock updating credit balances in the portfolio
      const credit = await tx.credit.findUnique({
        where: { id: auction.creditId },
      });

      if (credit) {
        // Determine total sold
        const totalSold = auction.quantity - auction.remaining;
        await tx.credit.update({
          where: { id: credit.id },
          data: {
            available: Math.max(0, credit.available - totalSold),
          },
        });
      }

      const settledAuction = await tx.auction.update({
        where: { id: auctionId },
        data: {
          status: 'settled',
          // Taking the latest bid as winner in a simple scenario, assuming first buyer to accept current price wins
          winnerId: auction.bids.length > 0 ? auction.bids[0].userId : null,
          finalPrice: auction.bids.length > 0 ? auction.bids[0].bidPrice : null,
        },
      });

      // Send notifications (Mock)
      this.logger.log(`Auction ${auctionId} settled successfully`);

      return settledAuction;
    });
  }
}
