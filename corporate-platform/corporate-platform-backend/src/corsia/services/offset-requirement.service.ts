import { Injectable } from '@nestjs/common';

@Injectable()
export class OffsetRequirementService {
  calculateOffsetRequirement(input: {
    year: number;
    totalEmissions: number;
    baselineEmissions: number;
    sectoralGrowthFactor?: number;
    individualGrowthFactor?: number;
  }) {
    const {
      year,
      totalEmissions,
      baselineEmissions,
      sectoralGrowthFactor = 1,
      individualGrowthFactor = 1,
    } = input;

    if (year < 2024) {
      return {
        year,
        totalEmissions,
        baselineEmissions,
        growthEmissions: 0,
        sectoralShare: 1,
        individualShare: 0,
        sectoralGrowthFactor,
        individualGrowthFactor,
        offsetRequirement: 0,
      };
    }

    const growthEmissions = Math.max(0, totalEmissions - baselineEmissions);
    const { sectoralShare, individualShare } = this.getGrowthShares(year);

    const weightedGrowthFactor =
      sectoralShare * sectoralGrowthFactor +
      individualShare * individualGrowthFactor;

    const offsetRequirement = growthEmissions * weightedGrowthFactor;

    return {
      year,
      totalEmissions,
      baselineEmissions,
      growthEmissions,
      sectoralShare,
      individualShare,
      sectoralGrowthFactor,
      individualGrowthFactor,
      offsetRequirement: Number(offsetRequirement.toFixed(6)),
    };
  }

  private getGrowthShares(year: number) {
    if (year <= 2029) {
      return { sectoralShare: 1, individualShare: 0 };
    }

    if (year <= 2032) {
      return { sectoralShare: 0.85, individualShare: 0.15 };
    }

    return { sectoralShare: 0.7, individualShare: 0.3 };
  }
}
