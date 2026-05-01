import { Test, TestingModule } from '@nestjs/testing';
import { RetirementAnalyticsController } from './analytics.controller';
import { RetirementAnalyticsService } from './analytics.service';

describe('RetirementAnalyticsController', () => {
  let controller: RetirementAnalyticsController;
  const user = { companyId: 'company-1', sub: 'user-1' } as any;

  const mockAnalyticsService = {
    getPurposeBreakdown: jest.fn(),
    getTrends: jest.fn(),
    getForecast: jest.fn(),
    getImpactMetrics: jest.fn(),
    getProgress: jest.fn(),
    getSummary: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RetirementAnalyticsController],
      providers: [
        {
          provide: RetirementAnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile();

    controller = module.get<RetirementAnalyticsController>(
      RetirementAnalyticsController,
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call getPurposeBreakdown on the service', async () => {
    const query = { startDate: '2026-01-01' };
    const expected = {
      purposes: [],
      totalRetired: 0,
      periodStart: '',
      periodEnd: '',
    };
    mockAnalyticsService.getPurposeBreakdown.mockResolvedValue(expected);

    const result = await controller.getPurposeBreakdown(query, user);

    expect(result).toEqual(expected);
    expect(mockAnalyticsService.getPurposeBreakdown).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: user.companyId,
        startDate: '2026-01-01',
      }),
    );
  });

  it('should call getTrends on the service', async () => {
    const query = { aggregation: 'monthly' as const };
    const expected = {
      periods: [],
      aggregation: 'monthly',
      totalRetired: 0,
      totalTarget: 0,
    };
    mockAnalyticsService.getTrends.mockResolvedValue(expected);

    const result = await controller.getTrends(query, user);

    expect(result).toEqual(expected);
    expect(mockAnalyticsService.getTrends).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: user.companyId,
        aggregation: 'monthly',
      }),
    );
  });

  it('should call getForecast on the service', async () => {
    const query = {};
    const expected = { projections: [], methodology: 'test', basedOnMonths: 0 };
    mockAnalyticsService.getForecast.mockResolvedValue(expected);

    const result = await controller.getForecast(query, user);

    expect(result).toEqual(expected);
    expect(mockAnalyticsService.getForecast).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: user.companyId }),
    );
  });

  it('should call getImpactMetrics on the service', async () => {
    const query = {};
    const expected = {
      co2Offset: 100,
      treesPlanted: 4545,
      carsRemoved: 21.74,
      homesPowered: 13.33,
      calculationStandard: 'GHG Protocol Corporate Standard',
    };
    mockAnalyticsService.getImpactMetrics.mockResolvedValue(expected);

    const result = await controller.getImpactMetrics(query, user);

    expect(result).toEqual(expected);
    expect(mockAnalyticsService.getImpactMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: user.companyId }),
    );
  });

  it('should call getProgress on the service', async () => {
    const query = {};
    const expected = {
      annual: { target: 1000, achieved: 500, percentage: 50 },
      netZero: { target: 10000, achieved: 2000, percentage: 20 },
      onTrack: true,
    };
    mockAnalyticsService.getProgress.mockResolvedValue(expected);

    const result = await controller.getProgress(query, user);

    expect(result).toEqual(expected);
    expect(mockAnalyticsService.getProgress).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: user.companyId }),
    );
  });

  it('should call getSummary on the service', async () => {
    const query = { endDate: '2026-12-31' };
    const expected = {
      purposeBreakdown: {},
      trends: {},
      forecast: {},
      impact: {},
      progress: {},
    };
    mockAnalyticsService.getSummary.mockResolvedValue(expected);

    const result = await controller.getSummary(query, user);

    expect(result).toEqual(expected);
    expect(mockAnalyticsService.getSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: user.companyId,
        endDate: '2026-12-31',
      }),
    );
  });
});
