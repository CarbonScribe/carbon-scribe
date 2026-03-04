import { Test, TestingModule } from '@nestjs/testing';
import { RiskService } from './risk.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('RiskService', () => {
  let service: RiskService;

  const mockPrismaService = {
    portfolio: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<RiskService>(RiskService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRiskMetrics', () => {
    it('should return default risk metrics if no portfolio', async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);

      const result = await service.getRiskMetrics('test-company-id');

      expect(result.diversificationScore).toBe(0);
      expect(result.riskRating).toBe('Low');
      expect(result.volatility).toBe(0);
    });

    it('should calculate diversification score correctly', async () => {
      const mockPortfolio = {
        id: 'portfolio-1',
        holdings: [
          { quantity: 100, credit: { projectId: 'proj-1' } },
          { quantity: 100, credit: { projectId: 'proj-2' } },
          { quantity: 100, credit: { projectId: 'proj-3' } },
        ],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const result = await service.getRiskMetrics('test-company-id');

      expect(result.diversificationScore).toBeGreaterThan(0);
      expect(result.diversificationScore).toBeLessThanOrEqual(100);
    });

    it('should identify concentration in portfolio', async () => {
      const mockPortfolio = {
        id: 'portfolio-1',
        holdings: [
          { quantity: 450, credit: { projectId: 'proj-1', country: 'Brazil' } },
          {
            quantity: 50,
            credit: { projectId: 'proj-2', country: 'Indonesia' },
          },
        ],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const result = await service.getRiskMetrics('test-company-id');

      expect(result.concentrationAnalysis.topProject.percentage).toBe(90);
      expect(result.concentrationAnalysis.herfindahlIndex).toBeGreaterThan(
        4000,
      );
    });

    it('should rate high risk when concentration is high', async () => {
      const mockPortfolio = {
        id: 'portfolio-1',
        holdings: [
          {
            quantity: 900,
            purchasePrice: 10,
            credit: { projectId: 'proj-1', country: 'Brazil' },
          },
          {
            quantity: 100,
            purchasePrice: 10,
            credit: { projectId: 'proj-2', country: 'Indonesia' },
          },
        ],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const result = await service.getRiskMetrics('test-company-id');

      expect(result.riskRating).toBe('High');
    });

    it('should rate low risk when diversified', async () => {
      const mockPortfolio = {
        id: 'portfolio-1',
        holdings: [
          {
            quantity: 100,
            purchasePrice: 10,
            credit: { projectId: 'proj-1', country: 'Brazil', standard: 'VCS' },
          },
          {
            quantity: 100,
            purchasePrice: 10,
            credit: {
              projectId: 'proj-2',
              country: 'Indonesia',
              standard: 'Gold Standard',
            },
          },
          {
            quantity: 100,
            purchasePrice: 10,
            credit: { projectId: 'proj-3', country: 'Kenya', standard: 'VCS' },
          },
          {
            quantity: 100,
            purchasePrice: 10,
            credit: {
              projectId: 'proj-4',
              country: 'Peru',
              standard: 'Gold Standard',
            },
          },
        ],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const result = await service.getRiskMetrics('test-company-id');

      expect(result.riskRating).toBe('Low');
      expect(result.diversificationScore).toBeGreaterThan(50);
    });

    it('should calculate volatility correctly', async () => {
      const mockPortfolio = {
        id: 'portfolio-1',
        holdings: [
          { quantity: 100, purchasePrice: 10, credit: { projectId: 'proj-1' } },
          { quantity: 100, purchasePrice: 20, credit: { projectId: 'proj-2' } },
          { quantity: 100, purchasePrice: 30, credit: { projectId: 'proj-3' } },
        ],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const result = await service.getRiskMetrics('test-company-id');

      expect(result.volatility).toBeGreaterThan(0);
    });

    it('should calculate quality distribution score', async () => {
      const mockPortfolio = {
        id: 'portfolio-1',
        holdings: [
          {
            quantity: 100,
            purchasePrice: 10,
            credit: { projectId: 'proj-1', standard: 'VCS' },
          },
          {
            quantity: 100,
            purchasePrice: 10,
            credit: { projectId: 'proj-2', standard: 'Plan Vivo' },
          },
          {
            quantity: 100,
            purchasePrice: 10,
            credit: { projectId: 'proj-3', standard: 'Unknown' },
          },
        ],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const result = await service.getRiskMetrics('test-company-id');

      expect(result.projectQualityDistribution.highQuality).toBeCloseTo(
        33.33,
        1,
      );
      expect(result.projectQualityDistribution.mediumQuality).toBeCloseTo(
        33.33,
        1,
      );
      expect(result.projectQualityDistribution.lowQuality).toBeCloseTo(
        33.33,
        1,
      );
    });
  });
});
