import { Test, TestingModule } from '@nestjs/testing';
import { PurposeBreakdownService } from './purpose-breakdown.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('PurposeBreakdownService', () => {
  let service: PurposeBreakdownService;

  const mockPrismaService = {
    retirement: {
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurposeBreakdownService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PurposeBreakdownService>(PurposeBreakdownService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return empty purposes when no retirements exist', async () => {
    mockPrismaService.retirement.groupBy.mockResolvedValue([]);

    const result = await service.getBreakdown('company-1');

    expect(result.purposes).toHaveLength(0);
    expect(result.totalRetired).toBe(0);
  });

  it('should calculate correct percentages that total 100%', async () => {
    mockPrismaService.retirement.groupBy.mockResolvedValue([
      { purpose: 'SCOPE_1', _sum: { amount: 100 } },
      { purpose: 'SCOPE_2', _sum: { amount: 200 } },
      { purpose: 'SCOPE_3', _sum: { amount: 50 } },
    ]);

    const result = await service.getBreakdown('company-1');

    expect(result.purposes).toHaveLength(3);
    expect(result.totalRetired).toBe(350);

    const totalPercentage = result.purposes.reduce(
      (sum, p) => sum + p.percentage,
      0,
    );
    expect(totalPercentage).toBeCloseTo(100, 1);
  });

  it('should map correct colors to each purpose', async () => {
    mockPrismaService.retirement.groupBy.mockResolvedValue([
      { purpose: 'SCOPE_1', _sum: { amount: 100 } },
      { purpose: 'CORPORATE', _sum: { amount: 50 } },
    ]);

    const result = await service.getBreakdown('company-1');

    const scope1 = result.purposes.find((p) => p.name === 'Scope 1');
    const corporate = result.purposes.find((p) => p.name === 'Corporate');

    expect(scope1?.color).toBe('#4CAF50');
    expect(corporate?.color).toBe('#9C27B0');
  });

  it('should map correct human-readable labels', async () => {
    mockPrismaService.retirement.groupBy.mockResolvedValue([
      { purpose: 'SCOPE_1', _sum: { amount: 50 } },
      { purpose: 'EVENTS', _sum: { amount: 50 } },
      { purpose: 'PRODUCT', _sum: { amount: 50 } },
    ]);

    const result = await service.getBreakdown('company-1');

    const names = result.purposes.map((p) => p.name);
    expect(names).toContain('Scope 1');
    expect(names).toContain('Events');
    expect(names).toContain('Product');
  });

  it('should apply date range filter', async () => {
    mockPrismaService.retirement.groupBy.mockResolvedValue([]);

    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-12-31');

    await service.getBreakdown('company-1', startDate, endDate);

    expect(mockPrismaService.retirement.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-1',
          retiredAt: {
            gte: startDate,
            lte: endDate,
          },
        }),
      }),
    );
  });

  it('should handle single category with 100%', async () => {
    mockPrismaService.retirement.groupBy.mockResolvedValue([
      { purpose: 'SCOPE_1', _sum: { amount: 500 } },
    ]);

    const result = await service.getBreakdown('company-1');

    expect(result.purposes).toHaveLength(1);
    expect(result.purposes[0].percentage).toBe(100);
  });
});
