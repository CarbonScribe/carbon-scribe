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
      auction: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      bid: {
        create: jest.fn(),
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
  });
});
