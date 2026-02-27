import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceService } from './performance.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('PerformanceService', () => {
  let service: PerformanceService;
  // let prisma: PrismaService;

  const mockPrismaService = {
    portfolio: {
      findUnique: jest.fn(),
    },
    retirement: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PerformanceService>(PerformanceService);
    // prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPerformanceMetrics', () => {
    it('should return empty metrics if no portfolio exists', async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);

      const result = await service.getPerformanceMetrics('test-company-id');

      expect(result.portfolioValue).toBe(0);
      expect(result.creditsHeld).toBe(0);
      expect(result.avgPricePerTon).toBe(0);
    });

    it('should calculate portfolio value correctly', async () => {
      const mockPortfolio = {
        id: 'portfolio-1',
        companyId: 'test-company-id',
        holdings: [
          {
            currentValue: 1000,
            quantity: 100,
            creditId: 'credit-1',
            credit: { projectId: 'proj-1' },
          },
          {
            currentValue: 2000,
            quantity: 200,
            creditId: 'credit-2',
            credit: { projectId: 'proj-2' },
          },
        ],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.retirement.findMany.mockResolvedValue([]);

      const result = await service.getPerformanceMetrics('test-company-id');

      expect(result.portfolioValue).toBe(3000);
      expect(result.creditsHeld).toBe(300);
    });

    it('should calculate average price per ton correctly', async () => {
      const mockPortfolio = {
        id: 'portfolio-1',
        companyId: 'test-company-id',
        holdings: [
          {
            purchasePrice: 10,
            quantity: 100,
            currentValue: 1000,
            creditId: 'credit-1',
            credit: { projectId: 'proj-1' },
          },
          {
            purchasePrice: 20,
            quantity: 100,
            currentValue: 2000,
            creditId: 'credit-2',
            credit: { projectId: 'proj-2' },
          },
        ],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.retirement.findMany.mockResolvedValue([]);

      const result = await service.getPerformanceMetrics('test-company-id');

      expect(result.avgPricePerTon).toBe(15);
    });

    it('should calculate project diversity correctly', async () => {
      const mockPortfolio = {
        id: 'portfolio-1',
        companyId: 'test-company-id',
        holdings: [
          {
            purchasePrice: 10,
            quantity: 100,
            currentValue: 1000,
            creditId: 'credit-1',
            credit: { projectId: 'proj-1' },
          },
          {
            purchasePrice: 10,
            quantity: 100,
            currentValue: 1000,
            creditId: 'credit-2',
            credit: { projectId: 'proj-2' },
          },
          {
            purchasePrice: 10,
            quantity: 100,
            currentValue: 1000,
            creditId: 'credit-3',
            credit: { projectId: 'proj-1' },
          },
        ],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.retirement.findMany.mockResolvedValue([]);

      const result = await service.getPerformanceMetrics('test-company-id');

      // 2 unique projects out of 3 holdings = 66.67%
      expect(result.projectDiversity).toBeCloseTo(66.67, 1);
    });

    it('should generate performance trends', async () => {
      const mockPortfolio = {
        id: 'portfolio-1',
        companyId: 'test-company-id',
        holdings: [
          {
            purchasePrice: 10,
            quantity: 100,
            currentValue: 1000,
            creditId: 'credit-1',
            credit: { projectId: 'proj-1' },
          },
        ],
      };

      const mockRetirements = [
        { amount: 50, retiredAt: new Date('2025-01-15') },
        { amount: 75, retiredAt: new Date('2025-02-15') },
      ];

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrismaService.retirement.findMany.mockResolvedValue(mockRetirements);

      const result = await service.getPerformanceMetrics('test-company-id');

      expect(result.performanceTrends.length).toBeGreaterThan(0);
      expect(result.monthlyRetirements.length).toBeGreaterThan(0);
    });
  });
});
