import { Test, TestingModule } from '@nestjs/testing';
import { RetirementAnalyticsController } from './analytics.controller';
import { RetirementAnalyticsService } from './analytics.service';

describe('RetirementAnalyticsController', () => {
  let controller: RetirementAnalyticsController;

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
    const query = { companyId: 'c1' };
    const expected = {
      purposes: [],
      totalRetired: 0,
      periodStart: '',
      periodEnd: '',
    };
    mockAnalyticsService.getPurposeBreakdown.mockResolvedValue(expected);

    const result = await controller.getPurposeBreakdown(query);

    expect(result).toEqual(expected);
    expect(mockAnalyticsService.getPurposeBreakdown).toHaveBeenCalledWith(
      query,
    );
  });

  it('should call getTrends on the service', async () => {
    const query = { companyId: 'c1', aggregation: 'monthly' as const };
    const expected = {
      periods: [],
      aggregation: 'monthly',
      totalRetired: 0,
      totalTarget: 0,
    };
    mockAnalyticsService.getTrends.mockResolvedValue(expected);

    const result = await controller.getTrends(query);

    expect(result).toEqual(expected);
    expect(mockAnalyticsService.getTrends).toHaveBeenCalledWith(query);
  });

  it('should call getForecast on the service', async () => {
    const query = { companyId: 'c1' };
    const expected = { projections: [], methodology: 'test', basedOnMonths: 0 };
    mockAnalyticsService.getForecast.mockResolvedValue(expected);

    const result = await controller.getForecast(query);

    expect(result).toEqual(expected);
    expect(mockAnalyticsService.getForecast).toHaveBeenCalledWith(query);
  });

  it('should call getImpactMetrics on the service', async () => {
    const query = { companyId: 'c1' };
    const expected = {
      co2Offset: 100,
      treesPlanted: 4545,
      carsRemoved: 21.74,
      homesPowered: 13.33,
      calculationStandard: 'GHG Protocol Corporate Standard',
    };
    mockAnalyticsService.getImpactMetrics.mockResolvedValue(expected);

    const result = await controller.getImpactMetrics(query);

    expect(result).toEqual(expected);
    expect(mockAnalyticsService.getImpactMetrics).toHaveBeenCalledWith(query);
  });

  it('should call getProgress on the service', async () => {
    const query = { companyId: 'c1' };
    const expected = {
      annual: { target: 1000, achieved: 500, percentage: 50 },
      netZero: { target: 10000, achieved: 2000, percentage: 20 },
      onTrack: true,
    };
    mockAnalyticsService.getProgress.mockResolvedValue(expected);

    const result = await controller.getProgress(query);

    expect(result).toEqual(expected);
    expect(mockAnalyticsService.getProgress).toHaveBeenCalledWith(query);
  });

  it('should call getSummary on the service', async () => {
    const query = { companyId: 'c1' };
    const expected = {
      purposeBreakdown: {},
      trends: {},
      forecast: {},
      impact: {},
      progress: {},
    };
    mockAnalyticsService.getSummary.mockResolvedValue(expected);

    const result = await controller.getSummary(query);

    expect(result).toEqual(expected);
    expect(mockAnalyticsService.getSummary).toHaveBeenCalledWith(query);
  });
});
