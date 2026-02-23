import { Test, TestingModule } from '@nestjs/testing';
import { ListingService } from './listing.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('ListingService', () => {
  let service: ListingService;
  let prisma: PrismaService;

  const mockPrismaService = {
    credit: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ListingService>(ListingService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated credits', async () => {
      const mockCredits = [{ id: '1', projectName: 'Test Project' }];
      mockPrismaService.credit.findMany.mockResolvedValue(mockCredits);
      mockPrismaService.credit.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockCredits);
      expect(result.total).toBe(1);
      expect(prisma.credit.findMany).toHaveBeenCalled();
    });

    it('should apply filters correctly', async () => {
      mockPrismaService.credit.findMany.mockResolvedValue([]);
      mockPrismaService.credit.count.mockResolvedValue(0);

      await service.findAll({
        methodology: 'VERRA',
        country: 'Brazil',
        minPrice: 10,
        maxPrice: 50,
        vintage: 2022,
      });

      expect(prisma.credit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            methodology: 'VERRA',
            country: 'Brazil',
            pricePerTon: { gte: 10, lte: 50 },
            vintage: 2022,
          }),
        }),
      );
    });
  });
});
