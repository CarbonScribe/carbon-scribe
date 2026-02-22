import { Test, TestingModule } from '@nestjs/testing';
import { TrendAnalysisService } from './trend-analysis.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('TrendAnalysisService', () => {
  let service: TrendAnalysisService;

  const mockPrismaService = {
    retirement: {
      findMany: jest.fn(),
    },
    retirementTarget: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrendAnalysisService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TrendAnalysisService>(TrendAnalysisService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return monthly periods with correct aggregation', async () => {
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-03-31');

    mockPrismaService.retirement.findMany
      .mockResolvedValueOnce([
        { retiredAt: new Date('2025-01-15'), amount: 100 },
        { retiredAt: new Date('2025-01-20'), amount: 50 },
        { retiredAt: new Date('2025-02-10'), amount: 200 },
        { retiredAt: new Date('2025-03-05'), amount: 75 },
      ])
      .mockResolvedValueOnce([]); // previous year

    mockPrismaService.retirementTarget.findMany.mockResolvedValue([
      { year: 2025, month: 1, target: 200 },
      { year: 2025, month: 2, target: 200 },
      { year: 2025, month: 3, target: 200 },
    ]);

    const result = await service.getTrends(
      'company-1',
      'monthly',
      startDate,
      endDate,
    );

    expect(result.aggregation).toBe('monthly');
    expect(result.periods).toHaveLength(3);

    // January: 100 + 50 = 150
    expect(result.periods[0].retired).toBe(150);
    expect(result.periods[0].target).toBe(200);
    expect(result.periods[0].cumulative).toBe(150);

    // February: 200
    expect(result.periods[1].retired).toBe(200);
    expect(result.periods[1].cumulative).toBe(350);

    // March: 75
    expect(result.periods[2].retired).toBe(75);
    expect(result.periods[2].cumulative).toBe(425);
  });

  it('should return quarterly aggregation', async () => {
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-06-30');

    mockPrismaService.retirement.findMany
      .mockResolvedValueOnce([
        { retiredAt: new Date('2025-01-15'), amount: 100 },
        { retiredAt: new Date('2025-02-10'), amount: 100 },
        { retiredAt: new Date('2025-03-05'), amount: 100 },
        { retiredAt: new Date('2025-04-15'), amount: 200 },
        { retiredAt: new Date('2025-05-10'), amount: 200 },
      ])
      .mockResolvedValueOnce([]); // previous year

    mockPrismaService.retirementTarget.findMany.mockResolvedValue([]);

    const result = await service.getTrends(
      'company-1',
      'quarterly',
      startDate,
      endDate,
    );

    expect(result.aggregation).toBe('quarterly');
    expect(result.periods.length).toBeGreaterThanOrEqual(2);

    const q1 = result.periods.find((p) => p.month === '2025-Q1');
    const q2 = result.periods.find((p) => p.month === '2025-Q2');

    expect(q1?.retired).toBe(300);
    expect(q2?.retired).toBe(400);
  });

  it('should handle empty retirements', async () => {
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-03-31');

    mockPrismaService.retirement.findMany.mockResolvedValue([]);
    mockPrismaService.retirementTarget.findMany.mockResolvedValue([]);

    const result = await service.getTrends(
      'company-1',
      'monthly',
      startDate,
      endDate,
    );

    expect(result.totalRetired).toBe(0);
    expect(result.periods.every((p) => p.retired === 0)).toBe(true);
  });

  it('should calculate correct cumulative totals', async () => {
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-03-31');

    mockPrismaService.retirement.findMany
      .mockResolvedValueOnce([
        { retiredAt: new Date('2025-01-10'), amount: 10 },
        { retiredAt: new Date('2025-02-10'), amount: 20 },
        { retiredAt: new Date('2025-03-10'), amount: 30 },
      ])
      .mockResolvedValueOnce([]); // previous year

    mockPrismaService.retirementTarget.findMany.mockResolvedValue([]);

    const result = await service.getTrends(
      'company-1',
      'monthly',
      startDate,
      endDate,
    );

    expect(result.periods[0].cumulative).toBe(10);
    expect(result.periods[1].cumulative).toBe(30);
    expect(result.periods[2].cumulative).toBe(60);
    expect(result.totalRetired).toBe(60);
  });

  it('should include YoY comparison data', async () => {
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-03-31');

    mockPrismaService.retirement.findMany
      .mockResolvedValueOnce([
        { retiredAt: new Date('2025-01-15'), amount: 200 },
        { retiredAt: new Date('2025-02-10'), amount: 300 },
      ])
      .mockResolvedValueOnce([
        { retiredAt: new Date('2024-01-15'), amount: 100 },
        { retiredAt: new Date('2024-02-10'), amount: 150 },
      ]);

    mockPrismaService.retirementTarget.findMany.mockResolvedValue([]);

    const result = await service.getTrends(
      'company-1',
      'monthly',
      startDate,
      endDate,
    );

    // YoY change: (500 - 250) / 250 * 100 = 100%
    expect(result.yearOverYearChange).toBe(100);
    // Previous year data should be populated
    expect(result.periods[0].previousYearRetired).toBe(100);
    expect(result.periods[1].previousYearRetired).toBe(150);
  });
});
