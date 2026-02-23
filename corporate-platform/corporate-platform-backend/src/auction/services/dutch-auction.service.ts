import { Injectable, Logger } from '@nestjs/common';
import { Auction } from '@prisma/client';

@Injectable()
export class DutchAuctionService {
  private readonly logger = new Logger(DutchAuctionService.name);

  /**
   * Calculates the current price of a Dutch auction based on its parameters and elapsed time.
   *
   * @param auction The auction record
   * @returns The calculated price at the current time
   */
  calculateCurrentPrice(auction: Auction): number {
    const now = new Date();

    // If auction hasn't started, return start price
    if (now < auction.startTime) {
      return auction.startPrice;
    }

    // If auction has ended or settled, return its last recorded price or currentPrice
    if (['ended', 'settled', 'cancelled'].includes(auction.status)) {
      return auction.currentPrice;
    }

    // Calculate time elapsed in minutes
    const elapsedMilliseconds = now.getTime() - auction.startTime.getTime();
    const elapsedMinutes = Math.floor(elapsedMilliseconds / (1000 * 60));

    // Calculate how many decrement intervals have passed
    const intervalsPassed = Math.floor(
      elapsedMinutes / auction.decrementInterval,
    );

    // Calculate new price
    const priceDrop = intervalsPassed * auction.priceDecrement;
    const newPrice = Math.max(
      auction.startPrice - priceDrop,
      auction.floorPrice,
    );

    return newPrice;
  }
}
