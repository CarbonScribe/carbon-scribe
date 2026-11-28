import { Test, TestingModule } from '@nestjs/testing';
import { BidProcessorService } from './bid-processor.service';
import { DutchAuctionService } from './dutch-auction.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('BidProcessorService', () => {
  let service: BidProcessorService;
  let prismaService: any;
  let dutchAuctionService: any;

  beforeEach(async () => {
    prismaService = {
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prismaService);
      }),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'a1' }]),
      auction: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      bid: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    dutchAuctionService = {
      calculateCurrentPrice: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BidProcessorService,
        { provide: PrismaService, useValue: prismaService },
        { provide: DutchAuctionService, useValue: dutchAuctionService },
      ],
    }).compile();

    service = module.get<BidProcessorService>(BidProcessorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processBid', () => {
    it('should throw if auction not found', async () => {
      prismaService.auction.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.processBid('a1', 'u1', 'c1', { bidPrice: 100, quantity: 10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if auction is not active', async () => {
      prismaService.auction.findUnique.mockResolvedValueOnce({
        status: 'ended',
      });
      await expect(
        service.processBid('a1', 'u1', 'c1', { bidPrice: 100, quantity: 10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create bid if valid', async () => {
      prismaService.auction.findUnique.mockResolvedValueOnce({
        id: 'a1',
        status: 'active',
        remaining: 50,
        endTime: new Date(Date.now() + 60000),
      });
      dutchAuctionService.calculateCurrentPrice.mockReturnValue(90);
      prismaService.bid.create.mockResolvedValueOnce({ id: 'b1' });

      const dto = { bidPrice: 100, quantity: 10 };
      const bid = await service.processBid('a1', 'u1', 'c1', dto);

      expect(prismaService.bid.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          auctionId: 'a1',
          bidPrice: 100,
          quantity: 10,
        }),
      });
      expect(prismaService.auction.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { remaining: 40, status: 'active' },
      });
      expect(bid.id).toBe('b1');
    });

    it('should set status to ended if remaining becomes 0', async () => {
      prismaService.auction.findUnique.mockResolvedValueOnce({
        id: 'a1',
        status: 'active',
        remaining: 10,
        endTime: new Date(Date.now() + 60000),
      });
      dutchAuctionService.calculateCurrentPrice.mockReturnValue(100);
      prismaService.bid.create.mockResolvedValueOnce({ id: 'b1' });

      const dto = { bidPrice: 100, quantity: 10 };
      await service.processBid('a1', 'u1', 'c1', dto);

      expect(prismaService.auction.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { remaining: 0, status: 'ended' },
      });
    });

    it('rejects a bid at the end time and uses the same time for pricing', async () => {
      const now = new Date('2026-01-01T00:00:00Z');
      jest.useFakeTimers().setSystemTime(now);
      try {
        const auction = { id: 'a1', status: 'active', remaining: 10, endTime: now };
        prismaService.auction.findUnique.mockResolvedValue(auction);
        await expect(service.processBid('a1', 'u1', 'c1', { bidPrice: 100, quantity: 1 })).rejects.toThrow('Auction has ended');
        auction.endTime = new Date(now.getTime() + 1);
        dutchAuctionService.calculateCurrentPrice.mockReturnValue(100);
        prismaService.bid.create.mockResolvedValue({ id: 'b1' });
        await service.processBid('a1', 'u1', 'c1', { bidPrice: 100, quantity: 1 });
        expect(dutchAuctionService.calculateCurrentPrice).toHaveBeenCalledWith(auction, now);
      } finally { jest.useRealTimers(); }
    });

    it('returns an existing bid for a matching key even after sellout', async () => {
      prismaService.auction.findUnique.mockResolvedValue({ id: 'a1', status: 'ended' });
      const existing = { id: 'b1', bidPrice: 100, quantity: 1 };
      prismaService.bid.findFirst.mockResolvedValue(existing);
      await expect(service.processBid('a1', 'u1', 'c1', { bidPrice: 100, quantity: 1, idempotencyKey: 'key' })).resolves.toEqual(existing);
      expect(prismaService.bid.create).not.toHaveBeenCalled();
      await expect(service.processBid('a1', 'u1', 'c1', { bidPrice: 101, quantity: 1, idempotencyKey: 'key' })).rejects.toThrow('different bid');
    });
  });
});
