import { Test, TestingModule } from '@nestjs/testing';
import { DutchAuctionService } from './dutch-auction.service';

describe('DutchAuctionService', () => {
  let service: DutchAuctionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DutchAuctionService],
    }).compile();

    service = module.get<DutchAuctionService>(DutchAuctionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateCurrentPrice', () => {
    const baseAuction = {
      id: 'auction-1',
      creditId: 'credit-1',
      quantity: 1000,
      remaining: 1000,
      startPrice: 100,
      currentPrice: 100,
      floorPrice: 50,
      priceDecrement: 5,
      decrementInterval: 10, // 10 minutes
      startTime: new Date(),
      endTime: new Date(), // doesn't matter for this test
      lastPriceUpdate: new Date(),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    it('should return start price if auction has not started yet', () => {
      const auction = {
        ...baseAuction,
        startTime: new Date(Date.now() + 100000), // starts in future
      };

      const price = service.calculateCurrentPrice(auction);
      expect(price).toBe(100);
    });

    it('should return fixed currentPrice if auction is ended', () => {
      const auction = {
        ...baseAuction,
        startTime: new Date(Date.now() - 1000000),
        status: 'ended',
        currentPrice: 75,
      };

      const price = service.calculateCurrentPrice(auction);
      expect(price).toBe(75);
    });

    it('should decrease price progressively based on interval', () => {
      // simulate 25 minutes ago => 2 intervals passed (2 * 5 = 10 decrement)
      const startTime = new Date(Date.now() - 25 * 60 * 1000);
      const auction = {
        ...baseAuction,
        startTime,
      };

      const price = service.calculateCurrentPrice(auction);
      expect(price).toBe(90);
    });

    it('should not go below floor price', () => {
      // simulate 1000 minutes ago => should be way below floor price
      const startTime = new Date(Date.now() - 1000 * 60 * 1000);
      const auction = {
        ...baseAuction,
        startTime,
      };

      const price = service.calculateCurrentPrice(auction);
      expect(price).toBe(50);
    });
  });
});
