import { OffsetRequirementService } from './offset-requirement.service';

describe('OffsetRequirementService', () => {
  const service = new OffsetRequirementService();

  it('returns zero requirement for years before offsetting applicability', () => {
    const result = service.calculateOffsetRequirement({
      year: 2023,
      totalEmissions: 120,
      baselineEmissions: 100,
    });

    expect(result.offsetRequirement).toBe(0);
  });

  it('calculates growth-based requirement for applicable year', () => {
    const result = service.calculateOffsetRequirement({
      year: 2031,
      totalEmissions: 140,
      baselineEmissions: 100,
      sectoralGrowthFactor: 1,
      individualGrowthFactor: 1,
    });

    expect(result.growthEmissions).toBe(40);
    expect(result.offsetRequirement).toBe(40);
  });
});
