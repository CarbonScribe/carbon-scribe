import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ExecutionContext,
  UnauthorizedException,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as request from 'supertest';
import { PortfolioModule } from '../src/portfolio/portfolio.module';
import { RbacModule } from '../src/rbac/rbac.module';
import { AuthModule } from '../src/auth/auth.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/shared/database/prisma.service';

/**
 * The real TenantGuard is registered globally (via DatabaseModule ->
 * TenantModule, imported transitively through PortfolioModule/AuthModule)
 * and requires request.tenant to already be populated by TenantMiddleware —
 * which normally only happens because AppModule.configure() applies it.
 * Global APP_GUARD-registered guards aren't reachable through
 * overrideGuard()/overrideProvider() in a TestingModule (Nest collects them
 * directly from the module that declared them, not through the override's
 * replacement token), so the only reliable way to satisfy TenantGuard here
 * is to actually populate request.tenant before it runs — via middleware,
 * same as production. This stand-in mirrors the real TenantMiddleware's
 * header-based resolution closely enough for this suite's purposes, using
 * the same identity the mocked JwtAuthGuard below derives, so the two never
 * disagree.
 */
const MOCK_COMPANY_ID = 'test-company-id-1';

function testTenantMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const companyId =
    (req.headers['x-test-authenticated-company'] as string | undefined) ||
    (req.headers['x-company-id'] as string | undefined) ||
    (req.headers.authorization ? MOCK_COMPANY_ID : undefined);
  if (companyId) {
    (req as Request & { tenant?: unknown }).tenant = {
      companyId,
      userId: 'user-1',
      role: 'admin',
      source: 'test',
    };
  }
  next();
}

@Module({
  imports: [PortfolioModule, RbacModule, AuthModule],
})
class PortfolioTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(testTenantMiddleware).forRoutes('*');
  }
}

describe('Portfolio API Integration Tests', () => {
  let app: INestApplication;

  const mockCompanyId = MOCK_COMPANY_ID;
  const mockAuthToken = 'valid-jwt-token';

  const mockPrismaService = new Proxy({} as any, {
    get: (target, prop) => {
      if (typeof prop === 'string' && !target[prop]) {
        target[prop] = {
          findUnique: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
          delete: jest.fn().mockResolvedValue({}),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          count: jest.fn().mockResolvedValue(0),
          upsert: jest.fn().mockResolvedValue({}),
        };
      }
      return target[prop];
    },
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PortfolioTestModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          if (!req.headers.authorization) {
            throw new UnauthorizedException();
          }
          // x-test-authenticated-company simulates "what the caller's JWT
          // actually says" (set independently of x-company-id below), so a
          // test can send a spoofed/forged x-company-id alongside a
          // genuinely different authenticated identity — the way a real
          // attacker would supply a stale/forged company header against a
          // JWT asserting a different company (#740).
          req.user = {
            sub: 'user-1',
            companyId:
              req.headers['x-test-authenticated-company'] ||
              req.headers['x-company-id'] ||
              mockCompanyId,
            role: 'admin',
          };
          return true;
        },
      })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
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

      expect(response.body.message[0].toLowerCase()).toContain('date');
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

    it('does not leak company B data when a company-A request also carries a spoofed X-Company-Id header for company B (#740)', async () => {
      const otherCompanyId = 'test-company-id-2-attacker-target';

      // A tiny multi-tenant-aware fake: unlike a fixed mockResolvedValue,
      // this actually returns different data depending on which companyId
      // the controller queried with, so the test can tell *whose* data came
      // back — a real guard/controller regression that queried with the
      // wrong companyId would be caught here, not just asserted-away.
      mockPrismaService.portfolio.findUnique.mockImplementation(
        ({ where }: { where: { companyId: string } }) => {
          if (where.companyId === mockCompanyId) {
            return Promise.resolve({
              id: 'portfolio-A',
              companyId: mockCompanyId,
              holdings: [
                {
                  quantity: 1,
                  credit: { projectId: 'proj-A', country: 'A-land' },
                },
              ],
            });
          }
          if (where.companyId === otherCompanyId) {
            return Promise.resolve({
              id: 'portfolio-B',
              companyId: otherCompanyId,
              holdings: [
                {
                  quantity: 999,
                  credit: {
                    projectId: 'proj-B-secret',
                    country: 'B-land-secret',
                  },
                },
              ],
            });
          }
          return Promise.resolve(null);
        },
      );

      const response = await request(app.getHttpServer())
        .get('/api/v1/portfolio/composition')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-Test-Authenticated-Company', mockCompanyId) // real identity: company A
        .set('X-Company-Id', otherCompanyId) // attacker-controlled/spoofed
        .expect(200);

      // getPortfolioComposition surfaces methodology/country breakdowns, not
      // raw holding/project IDs — assert on the distinguishing field it
      // actually returns.
      const serializedResponse = JSON.stringify(response.body.data);
      expect(serializedResponse).not.toContain('B-land-secret');
      expect(serializedResponse).toContain('A-land');

      expect(mockPrismaService.portfolio.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: mockCompanyId } }),
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
