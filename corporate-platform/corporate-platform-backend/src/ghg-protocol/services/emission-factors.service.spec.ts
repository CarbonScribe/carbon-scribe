import { EmissionFactorsService } from './emission-factors.service';

describe('EmissionFactorsService', () => {
  let service: EmissionFactorsService;
  let prisma: {
    emissionFactor: {
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      emissionFactor: {
        findMany: jest.fn(),
      },
    };

    service = new EmissionFactorsService(prisma as any);
  });

  it('prefers an exact regional factor over global fallback', async () => {
    prisma.emissionFactor.findMany.mockResolvedValue([
      {
        id: 'global-factor',
        source: 'EPA',
        activityType: 'ELECTRICITY',
        unit: 'kWh',
        region: 'GLOBAL',
        co2ePerUnit: 0.4,
        validFrom: new Date('2025-01-01T00:00:00.000Z'),
        validTo: null,
        methodology: 'location-based',
        isActive: true,
      },
      {
        id: 'us-factor',
        source: 'EPA',
        activityType: 'ELECTRICITY',
        unit: 'kWh',
        region: 'US',
        co2ePerUnit: 0.385,
        validFrom: new Date('2025-01-01T00:00:00.000Z'),
        validTo: null,
        methodology: 'location-based',
        isActive: true,
      },
    ]);

    const result = await service.resolveFactor({
      activityType: 'electricity',
      unit: 'kWh',
      region: 'us',
      asOfDate: new Date('2025-06-01T00:00:00.000Z'),
    });

    expect(result.id).toBe('us-factor');
  });

  it('falls back when a preferred source has no match', async () => {
    prisma.emissionFactor.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'fallback-factor',
          source: 'DEFRA',
          activityType: 'DISTANCE',
          unit: 'mile',
          region: 'GLOBAL',
          co2ePerUnit: 0.254,
          validFrom: new Date('2025-01-01T00:00:00.000Z'),
          validTo: null,
          methodology: 'distance-based',
          isActive: true,
        },
      ]);

    const result = await service.resolveFactor({
      activityType: 'distance',
      unit: 'mile',
      region: 'global',
      asOfDate: new Date('2025-06-01T00:00:00.000Z'),
      preferredSource: 'epa',
    });

    expect(result.id).toBe('fallback-factor');
    expect(prisma.emissionFactor.findMany).toHaveBeenCalledTimes(2);
  });
});
