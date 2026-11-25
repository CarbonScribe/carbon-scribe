import { Injectable, BadRequestException, ConflictException, Logger } from '@nestjs/common';
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
      // Serialize all bids for this auction, including idempotent retries.
      await tx.$queryRaw`SELECT "id" FROM "Auction" WHERE "id" = ${auctionId} FOR UPDATE`;
      // Capture time after waiting for the lock, so a queued bid cannot be
      // accepted using a timestamp from before the auction ended.
      const now = new Date();
      const auction = await tx.auction.findUnique({
        where: { id: auctionId },
      });

      if (!auction) {
        throw new BadRequestException('Auction not found');
      }

      if (dto.idempotencyKey) {
        const existing = await tx.bid.findFirst({
          where: { auctionId, userId, companyId, idempotencyKey: dto.idempotencyKey },
        });
        if (existing) {
          if (existing.bidPrice !== dto.bidPrice || existing.quantity !== dto.quantity) {
            throw new ConflictException('Idempotency key was already used for a different bid');
          }
          return existing;
        }
      }

      if (auction.status !== 'active') {
        throw new BadRequestException(`Auction is ${auction.status}`);
      }

      if (now >= auction.endTime) {
        throw new BadRequestException('Auction has ended');
      }

      // 2. Validate quantity
      if (!Number.isInteger(dto.quantity) || dto.quantity < 1 || !Number.isFinite(dto.bidPrice) || dto.bidPrice < 0) {
        throw new BadRequestException('Invalid bid price or quantity');
      }
      if (dto.quantity > auction.remaining) {
        throw new BadRequestException(
          `Requested quantity ${dto.quantity} exceeds available ${auction.remaining}`,
        );
      }

      // 3. Validate price
      const currentPrice =
        this.dutchAuctionService.calculateCurrentPrice(auction, now);
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
          idempotencyKey: dto.idempotencyKey,
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
