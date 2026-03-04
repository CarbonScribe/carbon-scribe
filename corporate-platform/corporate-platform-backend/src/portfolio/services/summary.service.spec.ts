import { Test, TestingModule } from '@nestjs/testing';
import { SummaryService } from './summary.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('SummaryService', () => {
  let service: SummaryService;
  // let prisma: PrismaService;

  const mockPrismaService = {
    portfolio: {
      findUnique: jest.fn(),
    },
    retirement: {
      findMany: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummaryService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SummaryService>(SummaryService);
    // prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSummaryMetrics', () => {
    it('should return empty summary if portfolio does not exist', async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);

      const result = await service.getSummaryMetrics('test-company-id');

      expect(result.totalRetired).toBe(0);
      expect(result.availableBalance).toBe(0);
      expect(result.netZeroProgress).toBe(0);
    });

    it('should calculate total retired correctly', async () => {
      const mockPortfolio = {
        id: 'portfolio-1',
        companyId: 'test-company-id',
        holdings: [],
      };

      const mockRetirements = [
        { amount: 100, purpose: 'scope1', retiredAt: new Date('2025-01-15') },
        { amount: 150, purpose: 'scope2', retiredAt: new Date('2025-02-15') },
        { amount: 75, purpose: 'scope3', retiredAt: new Date('2025-03-15') },
      ];

      const mockCompany = {
        id: 'test-company-id',
        netZeroTarget: 1000,
        netZeroTargetYear: 2030,
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.retirement.findMany.mockResolvedValue(mockRetirements);
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);

      const result = await service.getSummaryMetrics('test-company-id');

      expect(result.totalRetired).toBe(325);
    });

    it('should calculate net zero progress correctly', async () => {
      const mockPortfolio = {
        id: 'portfolio-1',
        companyId: 'test-company-id',
        holdings: [],
      };

      const mockRetirements = [
        { amount: 500, purpose: 'scope1', retiredAt: new Date() },
      ];

      const mockCompany = {
        id: 'test-company-id',
        netZeroTarget: 1000,
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.retirement.findMany.mockResolvedValue(mockRetirements);
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);

      const result = await service.getSummaryMetrics('test-company-id');

      expect(result.netZeroProgress).toBe(50);
    });

    it('should calculate scope 3 coverage correctly', async () => {
      const mockPortfolio = {
        id: 'portfolio-1',
        companyId: 'test-company-id',
        holdings: [],
      };

      const mockRetirements = [
        { amount: 100, purpose: 'scope1', retiredAt: new Date() },
        { amount: 100, purpose: 'scope3', retiredAt: new Date() },
        { amount: 100, purpose: 'scope3', retiredAt: new Date() },
      ];

      const mockCompany = {
        id: 'test-company-id',
        netZeroTarget: 1000,
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.retirement.findMany.mockResolvedValue(mockRetirements);
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);

      const result = await service.getSummaryMetrics('test-company-id');

      expect(result.scope3Coverage).toBeCloseTo(66.67, 1);
    });

    it('should calculate quarterly growth', async () => {
      const now = new Date();
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const mockPortfolio = {
        id: 'portfolio-1',
        companyId: 'test-company-id',
        holdings: [],
      };

      const mockRetirements = [
        {
          amount: 100,
          purpose: 'scope1',
          retiredAt: new Date(sixMonthsAgo.getTime() + 1000),
        },
        {
          amount: 200,
          purpose: 'scope1',
          retiredAt: new Date(threeMonthsAgo.getTime() + 1000),
        },
      ];

      const mockCompany = {
        id: 'test-company-id',
        netZeroTarget: 1000,
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.retirement.findMany.mockResolvedValue(mockRetirements);
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);

      const result = await service.getSummaryMetrics('test-company-id');

      expect(result.quarterlyGrowth).toBe(100);
    });
  });
});
