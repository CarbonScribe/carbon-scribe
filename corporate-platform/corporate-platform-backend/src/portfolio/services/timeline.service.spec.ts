import { Test, TestingModule } from '@nestjs/testing';
import { TimelineService } from './timeline.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('TimelineService', () => {
  let service: TimelineService;

  const mockPrismaService = {
    portfolio: {
      findUnique: jest.fn(),
    },
    portfolioSnapshot: {
      findMany: jest.fn(),
    },
    retirement: {
      findMany: jest.fn(),
    },
    portfolioHolding: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimelineService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TimelineService>(TimelineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTimelineMetrics', () => {
    it('should return empty timeline if no portfolio', async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);

      const result = await service.getTimelineMetrics('test-company-id');

      expect(result.portfolioGrowth.monthly).toEqual([]);
      expect(result.retirementTrends.monthly).toEqual([]);
      expect(result.valueOverTime.monthly).toEqual([]);
    });

    it('should aggregate retirements by month', async () => {
      const mockPortfolio = { id: 'portfolio-1' };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.portfolioSnapshot.findMany.mockResolvedValue([]);
      mockPrismaService.portfolioHolding.findMany.mockResolvedValue([]);
      mockPrismaService.retirement.findMany.mockResolvedValue([
        { amount: 100, retiredAt: new Date('2025-01-15') },
        { amount: 200, retiredAt: new Date('2025-01-20') },
        { amount: 150, retiredAt: new Date('2025-02-15') },
      ]);

      const result = await service.getTimelineMetrics('test-company-id');

      expect(result.retirementTrends.monthly.length).toBeGreaterThan(0);
      expect(result.retirementTrends.monthly[0]).toHaveProperty('date');
      expect(result.retirementTrends.monthly[0]).toHaveProperty('value');
    });

    it('should support date range filtering', async () => {
      const mockPortfolio = { id: 'portfolio-1' };
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-12-31');

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.portfolioSnapshot.findMany.mockResolvedValue([]);
      mockPrismaService.portfolioHolding.findMany.mockResolvedValue([]);
      mockPrismaService.retirement.findMany.mockResolvedValue([]);

      await service.getTimelineMetrics('test-company-id', startDate, endDate);

      expect(mockPrismaService.retirement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'test-company-id',
            retiredAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
        }),
      );
    });

    it('should aggregate by monthly, quarterly, and yearly', async () => {
      const mockPortfolio = { id: 'portfolio-1' };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.portfolioSnapshot.findMany.mockResolvedValue([]);
      mockPrismaService.portfolioHolding.findMany.mockResolvedValue([]);
      mockPrismaService.retirement.findMany.mockResolvedValue([
        { amount: 100, retiredAt: new Date('2025-01-15') },
        { amount: 50, retiredAt: new Date('2025-02-20') },
        { amount: 75, retiredAt: new Date('2025-04-10') },
      ]);

      const result = await service.getTimelineMetrics('test-company-id');

      expect(result.retirementTrends.monthly.length).toBeGreaterThan(0);
      expect(result.retirementTrends.quarterly.length).toBeGreaterThan(0);
      expect(result.retirementTrends.yearly.length).toBeGreaterThan(0);
    });
  });
});
