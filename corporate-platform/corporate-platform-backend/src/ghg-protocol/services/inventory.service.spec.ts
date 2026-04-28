import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: {
    emissionRecord: {
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      emissionRecord: {
        findMany: jest.fn(),
      },
    };

    service = new InventoryService(prisma as any);
  });

  it('aggregates totals by scope and verification status', async () => {
    prisma.emissionRecord.findMany.mockResolvedValue([
      {
        id: 'r1',
        companyId: 'company-1',
        sourceId: 's1',
        periodStart: new Date('2025-01-01T00:00:00.000Z'),
        periodEnd: new Date('2025-01-31T23:59:59.999Z'),
        activityValue: 100,
        unit: 'gallon',
        emissionFactor: 8.887,
        factorSource: 'EPA',
        factorRegion: 'US',
        co2e: 888.7,
        verified: true,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        source: { scope: 1, category: 'STATIONARY_COMBUSTION' },
      },
      {
        id: 'r2',
        companyId: 'company-1',
        sourceId: 's2',
        periodStart: new Date('2025-02-01T00:00:00.000Z'),
        periodEnd: new Date('2025-02-28T23:59:59.999Z'),
        activityValue: 250,
        unit: 'kWh',
        emissionFactor: 0.385,
        factorSource: 'EPA',
        factorRegion: 'US',
        co2e: 96.25,
        verified: false,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        source: { scope: 2, category: 'PURCHASED_ELECTRICITY' },
      },
    ]);

    const result = await service.getInventory(
      'company-1',
      { year: 2025 },
      {
        frameworkCode: 'GHG',
        complianceStatus: 'in_progress',
        requirements: [],
      },
    );

    expect(result.totalCo2e).toBe(984.95);
    expect(result.verifiedCo2e).toBe(888.7);
    expect(result.unverifiedCo2e).toBe(96.25);
    expect(result.totalsByScope.scope1).toBe(888.7);
    expect(result.totalsByScope.scope2).toBe(96.25);
    expect(result.totalsByScope.scope3).toBe(0);
    expect(result.categories).toHaveLength(2);
  });
});
