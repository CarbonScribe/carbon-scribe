import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { SecurityService } from '../security/security.service';
import { CanActivate } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { IpWhitelistGuard } from '../security/guards/ip-whitelist.guard';

describe('PortfolioController', () => {
  let controller: PortfolioController;
  // let service: PortfolioService;
  // let securityService: SecurityService;

  const mockUser = {
    sub: 'user-1',
    email: 'test@example.com',
    companyId: 'company-1',
    role: 'admin',
  };

  const mockPortfolioService = {
    getPortfolioSummary: jest.fn(),
    getPortfolioPerformance: jest.fn(),
    getPortfolioComposition: jest.fn(),
    getPortfolioTimeline: jest.fn(),
    getPortfolioRisk: jest.fn(),
    getPortfolioHoldings: jest.fn(),
    getPortfolioAnalytics: jest.fn(),
  };

  const mockSecurityService = {
    logEvent: jest.fn().mockResolvedValue(undefined),
  };

  const mockGuard: CanActivate = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PortfolioController],
      providers: [
        {
          provide: PortfolioService,
          useValue: mockPortfolioService,
        },
        {
          provide: SecurityService,
          useValue: mockSecurityService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(PermissionsGuard)
      .useValue(mockGuard)
      .overrideGuard(IpWhitelistGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<PortfolioController>(PortfolioController);
    // service = module.get<PortfolioService>(PortfolioService);
    // securityService = module.get<SecurityService>(SecurityService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /api/v1/portfolio/summary', () => {
    it('should return portfolio summary', async () => {
      const mockSummary = {
        totalRetired: 1000,
        availableBalance: 500,
        quarterlyGrowth: 10,
      };

      mockPortfolioService.getPortfolioSummary.mockResolvedValue(mockSummary);

      const result = await controller.getSummary(mockUser as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSummary);
      expect(mockSecurityService.logEvent).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/portfolio/performance', () => {
    it('should return portfolio performance', async () => {
      const mockPerformance = {
        portfolioValue: 50000,
        avgPricePerTon: 15,
        creditsHeld: 1000,
      };

      mockPortfolioService.getPortfolioPerformance.mockResolvedValue(
        mockPerformance,
      );

      const result = await controller.getPerformance(mockUser as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPerformance);
    });
  });

  describe('GET /api/v1/portfolio/composition', () => {
    it('should return portfolio composition', async () => {
      const mockComposition = {
        methodologyDistribution: [],
        geographicAllocation: [],
        sdgImpact: [],
      };

      mockPortfolioService.getPortfolioComposition.mockResolvedValue(
        mockComposition,
      );

      const result = await controller.getComposition(mockUser as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockComposition);
    });
  });

  describe('GET /api/v1/portfolio/timeline', () => {
    it('should return portfolio timeline', async () => {
      const mockTimeline = {
        portfolioGrowth: { monthly: [], quarterly: [], yearly: [] },
        retirementTrends: { monthly: [], quarterly: [], yearly: [] },
        valueOverTime: { monthly: [], quarterly: [], yearly: [] },
      };

      mockPortfolioService.getPortfolioTimeline.mockResolvedValue(mockTimeline);

      const result = await controller.getTimeline(mockUser as any, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTimeline);
    });

    it('should handle invalid date formats', async () => {
      const query = { startDate: 'invalid-date' };

      await expect(
        controller.getTimeline(mockUser as any, query as any),
      ).rejects.toThrow('Invalid startDate format');
    });
  });

  describe('GET /api/v1/portfolio/risk', () => {
    it('should return portfolio risk assessment', async () => {
      const mockRisk = {
        diversificationScore: 75,
        riskRating: 'Low',
        volatility: 5,
      };

      mockPortfolioService.getPortfolioRisk.mockResolvedValue(mockRisk);

      const result = await controller.getRisk(mockUser as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRisk);
    });
  });

  describe('GET /api/v1/portfolio/holdings', () => {
    it('should return paginated holdings list', async () => {
      const mockHoldings = {
        data: [],
        total: 50,
        page: 1,
        pageSize: 20,
        pages: 3,
      };

      mockPortfolioService.getPortfolioHoldings.mockResolvedValue(mockHoldings);

      const result = await controller.getHoldings(mockUser as any, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockHoldings);
    });
  });

  describe('GET /api/v1/portfolio/analytics', () => {
    it('should return combined analytics dashboard', async () => {
      const mockAnalytics = {
        summary: {},
        performance: {},
        composition: {},
        timeline: {},
        risk: {},
        generatedAt: new Date(),
      };

      mockPortfolioService.getPortfolioAnalytics.mockResolvedValue(
        mockAnalytics,
      );

      const result = await controller.getAnalytics(mockUser as any);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAnalytics);
      expect(mockSecurityService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            analyticsType: 'full_dashboard',
          }),
        }),
      );
    });
  });
});
