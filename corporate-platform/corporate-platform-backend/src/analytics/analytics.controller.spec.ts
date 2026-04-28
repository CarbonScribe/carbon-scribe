import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { DashboardService } from './services/dashboard.service';
import { PredictiveService } from './services/predictive.service';
import { CreditQualityService } from './services/credit-quality.service';
import { PerformanceService } from './services/performance.service';
import { ProjectComparisonService } from './services/project-comparison.service';
import { RegionalService } from './services/regional.service';
import { TeamPerformanceService } from './services/team-performance.service';
import { TimelineService } from './services/timeline.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Reflector } from '@nestjs/core';
import { RbacService } from '../rbac/rbac.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let dashboardService: DashboardService;
  let predictiveService: PredictiveService;
  let creditQualityService: CreditQualityService;
  let projectComparisonService: ProjectComparisonService;

  const mockUser: JwtPayload = {
    sub: 'user123',
    companyId: 'company123',
    email: 'test@example.com',
    role: 'admin',
    sessionId: 'session123',
  };

  beforeEach(async () => {
    const mockServices = {
      AnalyticsService: {
        getRetirementSummary: jest.fn().mockResolvedValue({
          summary: { totalRetired: 1000, totalTransactions: 10 },
          trends: { thisMonth: 100, lastMonth: 80, percentageChange: 25 },
        }),
        getRetirementTrends: jest.fn().mockResolvedValue({
          labels: ['Jan', 'Feb'],
          datasets: [],
        }),
        getRetirementBreakdown: jest.fn().mockResolvedValue({
          dimension: 'entity',
          data: [],
          total: 1000,
        }),
      },
      DashboardService: {
        getOverview: jest.fn().mockResolvedValue({
          totalProjects: 10,
          activeProjects: 8,
          totalCreditsRetired: 5000,
        }),
        getInsights: jest.fn().mockResolvedValue({
          anomalies: [],
          trends: [],
          recommendations: [],
          riskAlerts: [],
        }),
      },
      PredictiveService: {
        forecastRetirements: jest.fn().mockResolvedValue({
          forecast: [],
          confidence: 0.85,
          methodology: 'ARIMA',
          lastUpdated: new Date(),
        }),
        forecastImpact: jest.fn().mockResolvedValue({
          forecast: [],
          confidence: 0.8,
          methodology: 'Time-series',
          lastUpdated: new Date(),
        }),
        detectTrends: jest.fn().mockResolvedValue([]),
      },
      CreditQualityService: {
        getRadarData: jest.fn().mockResolvedValue({
          projectId: 'proj123',
          projectName: 'Test Project',
          overallScore: 85,
          dimensions: [],
          riskFactors: [],
          lastUpdated: new Date(),
        }),
        getPortfolioQuality: jest.fn().mockResolvedValue([]),
        getBenchmarks: jest.fn().mockResolvedValue({}),
      },
      PerformanceService: {
        getPerformanceOverTime: jest.fn().mockResolvedValue({
          metric: 'retirement_volume',
          data: [],
          aggregation: 'monthly',
        }),
        getMetricBreakdown: jest.fn().mockResolvedValue({
          metric: 'test',
          totalValue: 100,
          byDimension: [],
        }),
        getPerformanceRankings: jest.fn().mockResolvedValue({
          metric: 'quality',
          rankings: [],
          period: 'MONTHLY',
        }),
      },
      ProjectComparisonService: {
        compareProjects: jest.fn().mockResolvedValue([]),
        findSimilarProjects: jest.fn().mockResolvedValue([]),
        findOutliers: jest.fn().mockResolvedValue({
          topPerformers: [],
          bottomPerformers: [],
        }),
      },
      RegionalService: {
        getRegionalBreakdown: jest.fn().mockResolvedValue([]),
        getRegionalHeatmap: jest.fn().mockResolvedValue({
          data: [],
          giniCoefficient: 0.3,
        }),
        getRegionalTrends: jest.fn().mockResolvedValue([]),
      },
      TeamPerformanceService: {
        getTeamPerformance: jest.fn().mockResolvedValue([]),
        getTeamRankings: jest.fn().mockResolvedValue([]),
        getTeamPortfolio: jest.fn().mockResolvedValue({
          developerCount: 1,
          projectCount: 5,
        }),
      },
      TimelineService: {
        getCarbonReductionTimeline: jest.fn().mockResolvedValue({
          data: [],
          currentTotal: 10000,
        }),
        getReductionProjections: jest.fn().mockResolvedValue({
          scenarios: {},
        }),
        getMilestones: jest.fn().mockResolvedValue({
          milestones: [],
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockServices.AnalyticsService,
        },
        {
          provide: DashboardService,
          useValue: mockServices.DashboardService,
        },
        {
          provide: PredictiveService,
          useValue: mockServices.PredictiveService,
        },
        {
          provide: CreditQualityService,
          useValue: mockServices.CreditQualityService,
        },
        {
          provide: PerformanceService,
          useValue: mockServices.PerformanceService,
        },
        {
          provide: ProjectComparisonService,
          useValue: mockServices.ProjectComparisonService,
        },
        {
          provide: RegionalService,
          useValue: mockServices.RegionalService,
        },
        {
          provide: TeamPerformanceService,
          useValue: mockServices.TeamPerformanceService,
        },
        {
          provide: TimelineService,
          useValue: mockServices.TimelineService,
        },
        {
          provide: Reflector,
          useValue: { get: jest.fn() },
        },
        {
          provide: RbacService,
          useValue: { checkPermissions: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    dashboardService = module.get<DashboardService>(DashboardService);
    predictiveService = module.get<PredictiveService>(PredictiveService);
    creditQualityService =
      module.get<CreditQualityService>(CreditQualityService);
    projectComparisonService = module.get<ProjectComparisonService>(
      ProjectComparisonService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // Retirement Analytics Tests (Issue #237)
  describe('getRetirementSummary', () => {
    it('should return retirement summary', async () => {
      const result = await controller.getRetirementSummary(mockUser);
      expect(result).toBeDefined();
    });
  });

  describe('getRetirementTrends', () => {
    it('should return retirement trends', async () => {
      const result = await controller.getRetirementTrends(mockUser);
      expect(result).toBeDefined();
    });

    it('should reject invalid months', async () => {
      await expect(controller.getRetirementTrends(mockUser, '100')).rejects.toThrow();
    });
  });

  describe('getRetirementBreakdown', () => {
    it('should return retirement breakdown', async () => {
      const result = await controller.getRetirementBreakdown(mockUser);
      expect(result).toBeDefined();
    });

    it('should reject invalid dimension', async () => {
      await expect(controller.getRetirementBreakdown(mockUser, 'invalid')).rejects.toThrow();
    });
  });

  // Dashboard Tests
  describe('getDashboardOverview', () => {
    it('should return dashboard overview', async () => {
      const result = await controller.getDashboardOverview(mockUser);
      expect(result).toBeDefined();
      expect(dashboardService.getOverview).toHaveBeenCalledWith(
        mockUser.companyId,
        'MONTHLY',
      );
    });
  });

  describe('getDashboardInsights', () => {
    it('should return dashboard insights', async () => {
      const result = await controller.getDashboardInsights(mockUser);
      expect(result).toBeDefined();
      expect(dashboardService.getInsights).toHaveBeenCalledWith(
        mockUser.companyId,
      );
    });
  });

  // Predictive Tests
  describe('predictRetirements', () => {
    it('should forecast retirements', async () => {
      const result = await controller.predictRetirements(mockUser);
      expect(result).toBeDefined();
      expect(predictiveService.forecastRetirements).toHaveBeenCalledWith(
        mockUser.companyId,
        12,
      );
    });

    it('should reject invalid months parameter', async () => {
      await expect(
        controller.predictRetirements(mockUser, '200'),
      ).rejects.toThrow('Months must be between 1 and 120');
    });
  });

  describe('predictImpact', () => {
    it('should forecast impact', async () => {
      const result = await controller.predictImpact(mockUser);
      expect(result).toBeDefined();
    });
  });

  describe('detectTrends', () => {
    it('should detect trends', async () => {
      const result = await controller.detectTrends(mockUser);
      expect(result).toBeDefined();
      expect(predictiveService.detectTrends).toHaveBeenCalledWith(
        mockUser.companyId,
      );
    });
  });

  // Credit Quality Tests
  describe('getQualityRadar', () => {
    it('should get quality radar data', async () => {
      const projectId = 'proj123';
      const result = await controller.getQualityRadar(mockUser, projectId);
      expect(result).toBeDefined();
      expect(creditQualityService.getRadarData).toHaveBeenCalledWith(projectId);
    });
  });

  describe('getPortfolioQuality', () => {
    it('should get portfolio quality scores', async () => {
      const result = await controller.getPortfolioQuality(mockUser);
      expect(result).toBeDefined();
    });
  });

  describe('getQualityBenchmarks', () => {
    it('should get quality benchmarks', async () => {
      const result = await controller.getQualityBenchmarks(
        'forestry',
        'Africa',
      );
      expect(result).toBeDefined();
    });
  });

  // Performance Tests
  describe('getPerformanceOverTime', () => {
    it('should get performance over time', async () => {
      const result = await controller.getPerformanceOverTime(mockUser, {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      } as any);
      expect(result).toBeDefined();
    });

    it('should reject missing dates', async () => {
      await expect(
        controller.getPerformanceOverTime(mockUser, {} as any),
      ).rejects.toThrow('startDate and endDate are required');
    });
  });

  describe('getPerformanceByMetric', () => {
    it('should get metric breakdown', async () => {
      const result = await controller.getPerformanceByMetric(mockUser);
      expect(result).toBeDefined();
    });
  });

  describe('getPerformanceRankings', () => {
    it('should get performance rankings', async () => {
      const result = await controller.getPerformanceRankings(mockUser);
      expect(result).toBeDefined();
    });
  });

  // Project Comparison Tests
  describe('compareProjects', () => {
    it('should compare projects', async () => {
      const result = await controller.compareProjects(mockUser, 'proj1,proj2');
      expect(result).toBeDefined();
      expect(projectComparisonService.compareProjects).toHaveBeenCalledWith([
        'proj1',
        'proj2',
      ]);
    });

    it('should reject missing projectIds', async () => {
      await expect(controller.compareProjects(mockUser, '')).rejects.toThrow(
        'projectIds query parameter is required',
      );
    });
  });

  describe('getSimilarProjects', () => {
    it('should find similar projects', async () => {
      const result = await controller.getSimilarProjects(mockUser, 'proj123');
      expect(result).toBeDefined();
    });
  });

  describe('getOutliers', () => {
    it('should find outlier projects', async () => {
      const result = await controller.getOutliers(mockUser);
      expect(result).toBeDefined();
    });

    it('should reject invalid metric', async () => {
      await expect(controller.getOutliers(mockUser, 'invalid')).rejects.toThrow(
        /Metric must be one of:/,
      );
    });
  });

  // Regional Tests
  describe('getRegionalBreakdown', () => {
    it('should get regional breakdown', async () => {
      const result = await controller.getRegionalBreakdown(mockUser);
      expect(result).toBeDefined();
    });
  });

  describe('getRegionalHeatmap', () => {
    it('should get regional heatmap', async () => {
      const result = await controller.getRegionalHeatmap(mockUser);
      expect(result).toBeDefined();
    });
  });

  describe('getRegionalTrends', () => {
    it('should get regional trends', async () => {
      const result = await controller.getRegionalTrends(mockUser);
      expect(result).toBeDefined();
    });
  });

  // Team Tests
  describe('getTeamPerformance', () => {
    it('should get team performance', async () => {
      const result = await controller.getTeamPerformance(mockUser);
      expect(result).toBeDefined();
    });
  });

  describe('getTeamRankings', () => {
    it('should get team rankings', async () => {
      const result = await controller.getTeamRankings(mockUser);
      expect(result).toBeDefined();
    });
  });

  describe('getTeamPortfolio', () => {
    it('should get team portfolio', async () => {
      const result = await controller.getTeamPortfolio(mockUser);
      expect(result).toBeDefined();
    });
  });

  // Timeline Tests
  describe('getCarbonTimeline', () => {
    it('should get carbon timeline', async () => {
      const result = await controller.getCarbonTimeline(mockUser);
      expect(result).toBeDefined();
    });
  });

  describe('getReductionProjections', () => {
    it('should get reduction projections', async () => {
      const result = await controller.getReductionProjections(mockUser);
      expect(result).toBeDefined();
    });
  });

  describe('getMilestones', () => {
    it('should get milestones', async () => {
      const result = await controller.getMilestones(mockUser);
      expect(result).toBeDefined();
    });
  });
}); 