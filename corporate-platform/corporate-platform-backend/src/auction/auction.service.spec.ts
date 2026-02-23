import { Test, TestingModule } from '@nestjs/testing';
import { AuctionService } from './auction.service';
import { DutchAuctionService } from './services/dutch-auction.service';
import { BidProcessorService } from './services/bid-processor.service';
import { SettlementService } from './services/settlement.service';
import { PrismaService } from '../shared/database/prisma.service';

describe('AuctionService (Integration setup)', () => {
  let service: AuctionService;
  let prismaService: any;
  let bidProcessorService: any;
  let settlementService: any;

  beforeEach(async () => {
    prismaService = {
      auction: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      bid: {
        findMany: jest.fn(),
      },
    };

    bidProcessorService = {
      processBid: jest.fn(),
    };

    settlementService = {
      settleAuction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuctionService,
        DutchAuctionService,
        { provide: BidProcessorService, useValue: bidProcessorService },
        { provide: SettlementService, useValue: settlementService },
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<AuctionService>(AuctionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAuction', () => {
    it('should create an auction successfully', async () => {
      const dto = {
        creditId: 'c1',
        quantity: 1000,
        startPrice: 100,
        floorPrice: 50,
        priceDecrement: 5,
        decrementInterval: 10,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 86400000).toISOString(),
      };

      prismaService.auction.create.mockResolvedValueOnce({ id: 'a1', ...dto });

      const result = await service.createAuction(dto);
      expect(prismaService.auction.create).toHaveBeenCalled();
      expect(result.id).toEqual('a1');
    });
  });

  describe('placeBid', () => {
    it('should delegate to BidProcessorService', async () => {
      bidProcessorService.processBid.mockResolvedValueOnce({ id: 'b1' });
      const result = await service.placeBid('a1', 'u1', 'co1', {
        bidPrice: 100,
        quantity: 10,
      });
      expect(bidProcessorService.processBid).toHaveBeenCalledWith(
        'a1',
        'u1',
        'co1',
        { bidPrice: 100, quantity: 10 },
      );
      expect(result.id).toBe('b1');
    });
  });

  describe('settleAuction', () => {
    it('should delegate to SettlementService', async () => {
      settlementService.settleAuction.mockResolvedValueOnce({
        id: 'a1',
        status: 'settled',
      });
      const result = await service.settleAuction('a1');
      expect(settlementService.settleAuction).toHaveBeenCalledWith('a1');
      expect(result.status).toBe('settled');
    });
  });
});
