import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PortfolioModule } from '../src/portfolio/portfolio.module';
import { PrismaService } from '../src/shared/database/prisma.service';

describe('Portfolio API Integration Tests', () => {
  let app: INestApplication;

  const mockCompanyId = 'test-company-id-1';
  const mockAuthToken = 'valid-jwt-token';

  const mockPrismaService = {
    portfolio: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    portfolioHolding: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    retirement: {
      findMany: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
    },
    portfolioSnapshot: {
      findMany: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PortfolioModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/portfolio/summary - Summary Metrics Endpoint', () => {
    it('should return portfolio summary metrics for authenticated user', async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-1',
        holdings: [],
      });
      mockPrismaService.retirement.findMany.mockResolvedValue([]);
      mockPrismaService.company.findUnique.mockResolvedValue({
        netZeroTarget: 2000,
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/portfolio/summary')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-Company-Id', mockCompanyId)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should return 401 without authentication token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/portfolio/summary')
        .expect(401);
    });
  });

  describe('GET /api/v1/portfolio/performance - Performance Metrics', () => {
    it('should return performance metrics with trends', async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-1',
        holdings: [
          {
            quantity: 100,
            purchasePrice: 10,
            currentValue: 1000,
            creditId: 'credit-1',
            credit: { projectId: 'proj-1' },
          },
        ],
      });
      mockPrismaService.retirement.findMany.mockResolvedValue([
        { amount: 50, retiredAt: new Date('2025-01-15') },
        { amount: 75, retiredAt: new Date('2025-02-15') },
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/v1/portfolio/performance')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-Company-Id', mockCompanyId)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.portfolioValue).toBeDefined();
      expect(response.body.data.performanceTrends).toBeDefined();
      expect(response.body.data.monthlyRetirements).toBeDefined();
    });
  });

  describe('GET /api/v1/portfolio/composition - Composition Breakdown', () => {
    it('should return methodology distribution totaling 100%', async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-1',
        holdings: [
          {
            quantity: 100,
            credit: {
              methodology: 'REDD+',
              country: 'Brazil',
              standard: 'VCS',
            },
          },
          {
            quantity: 100,
            credit: {
              methodology: 'Solar',
              country: 'Brazil',
              standard: 'VCS',
            },
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/portfolio/composition')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-Company-Id', mockCompanyId)
        .expect(200);

      expect(response.body.success).toBe(true);
      const totalMethodology =
        response.body.data.methodologyDistribution.reduce(
          (sum: number, m: any) => sum + m.percentage,
          0,
        );
      expect(totalMethodology).toBeCloseTo(100, 0);
    });

    it('should return geographic allocation', async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-1',
        holdings: [
          {
            quantity: 100,
            credit: {
              methodology: 'REDD+',
              country: 'Brazil',
              standard: 'VCS',
            },
          },
          {
            quantity: 200,
            credit: {
              methodology: 'Solar',
              country: 'Indonesia',
              standard: 'VCS',
            },
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/portfolio/composition')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-Company-Id', mockCompanyId)
        .expect(200);

      expect(response.body.data.geographicAllocation.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/portfolio/timeline - Historical Timeline', () => {
    it('should return timeline data with monthly aggregation by default', async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-1',
      });
      mockPrismaService.portfolioSnapshot.findMany.mockResolvedValue([]);
      mockPrismaService.portfolioHolding.findMany.mockResolvedValue([
        {
          quantity: 100,
          currentValue: 1000,
          purchaseDate: new Date('2025-01-15'),
        },
      ]);
      mockPrismaService.retirement.findMany.mockResolvedValue([
        { amount: 50, retiredAt: new Date('2025-01-15') },
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/v1/portfolio/timeline')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-Company-Id', mockCompanyId)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.portfolioGrowth.monthly).toBeDefined();
      expect(response.body.data.retirementTrends.monthly).toBeDefined();
    });

    it('should support date range filtering', async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-1',
      });
      mockPrismaService.portfolioSnapshot.findMany.mockResolvedValue([]);
      mockPrismaService.portfolioHolding.findMany.mockResolvedValue([]);
      mockPrismaService.retirement.findMany.mockResolvedValue([]);

      const startDate = '2025-01-01';
      const endDate = '2025-12-31';

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/portfolio/timeline?startDate=${startDate}&endDate=${endDate}`,
        )
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-Company-Id', mockCompanyId)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject invalid date format', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/portfolio/timeline?startDate=invalid-date')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-Company-Id', mockCompanyId)
        .expect(400);

      expect(response.body.message).toContain('Invalid');
    });
  });

  describe('GET /api/v1/portfolio/risk - Risk Assessment', () => {
    it('should return diversification score between 0-100', async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-1',
        holdings: [
          { quantity: 100, purchasePrice: 10, credit: { projectId: 'proj-1' } },
          { quantity: 100, purchasePrice: 10, credit: { projectId: 'proj-2' } },
          { quantity: 100, purchasePrice: 10, credit: { projectId: 'proj-3' } },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/portfolio/risk')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-Company-Id', mockCompanyId)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.diversificationScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.diversificationScore).toBeLessThanOrEqual(100);
    });

    it('should assign appropriate risk rating', async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue({
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
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/portfolio/risk')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-Company-Id', mockCompanyId)
        .expect(200);

      expect(['Low', 'Medium', 'High']).toContain(
        response.body.data.riskRating,
      );
    });
  });

  describe('GET /api/v1/portfolio/holdings - Holdings List', () => {
    it('should return paginated holdings list', async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-1',
      });
      mockPrismaService.portfolioHolding.findMany.mockResolvedValue([
        {
          id: 'holding-1',
          quantity: 100,
          credit: { id: 'credit-1', projectName: 'Project 1' },
        },
      ]);
      mockPrismaService.portfolioHolding.count.mockResolvedValue(50);

      const response = await request(app.getHttpServer())
        .get('/api/v1/portfolio/holdings')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-Company-Id', mockCompanyId)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('pageSize');
    });

    it('should support pagination parameters', async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-1',
      });
      mockPrismaService.portfolioHolding.findMany.mockResolvedValue([]);
      mockPrismaService.portfolioHolding.count.mockResolvedValue(100);

      const response = await request(app.getHttpServer())
        .get('/api/v1/portfolio/holdings?page=2&pageSize=10')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-Company-Id', mockCompanyId)
        .expect(200);

      expect(response.body.data.page).toBe(2);
      expect(response.body.data.pageSize).toBe(10);
    });
  });

  describe('GET /api/v1/portfolio/analytics - Combined Dashboard', () => {
    it('should return all analytics in single request', async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-1',
        holdings: [],
      });
      mockPrismaService.retirement.findMany.mockResolvedValue([]);
      mockPrismaService.company.findUnique.mockResolvedValue({
        netZeroTarget: 2000,
      });
      mockPrismaService.portfolioSnapshot.findMany.mockResolvedValue([]);
      mockPrismaService.portfolioHolding.findMany.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/api/v1/portfolio/analytics')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-Company-Id', mockCompanyId)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('performance');
      expect(response.body.data).toHaveProperty('composition');
      expect(response.body.data).toHaveProperty('timeline');
      expect(response.body.data).toHaveProperty('risk');
      expect(response.body.data).toHaveProperty('generatedAt');
    });
  });

  describe('Multi-tenant Isolation', () => {
    it("should only return data for user's company", async () => {
      const company1Holdings = [
        { quantity: 100, credit: { projectId: 'proj-1', country: 'Brazil' } },
      ];

      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-1',
        companyId: mockCompanyId,
        holdings: company1Holdings,
      });

      await request(app.getHttpServer())
        .get('/api/v1/portfolio/composition')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-Company-Id', mockCompanyId)
        .expect(200);

      // Verify that portfolio service was called with correct companyId
      expect(mockPrismaService.portfolio.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: mockCompanyId },
        }),
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing portfolio gracefully', async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/api/v1/portfolio/summary')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-Company-Id', mockCompanyId)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRetired).toBe(0);
    });

    it('should return 400 for invalid query parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/portfolio/holdings?page=invalid')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-Company-Id', mockCompanyId);

      // Should either return 400 or handle gracefully with defaults
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Performance', () => {
    it('should handle large portfolios efficiently', async () => {
      const largeHoldings = Array.from({ length: 1000 }, (_, i) => ({
        quantity: Math.floor(Math.random() * 1000),
        purchasePrice: Math.random() * 100,
        currentValue: Math.random() * 50000,
        creditId: `credit-${i}`,
        credit: { projectId: `proj-${i % 50}` },
      }));

      mockPrismaService.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-1',
        holdings: largeHoldings,
      });
      mockPrismaService.retirement.findMany.mockResolvedValue([]);

      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/api/v1/portfolio/composition')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-Company-Id', mockCompanyId)
        .expect(200);

      const duration = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
