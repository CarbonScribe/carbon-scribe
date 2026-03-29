import { Injectable } from '@nestjs/common';

export interface EligibleFuel {
  code: string;
  name: string;
  lifecycleReductionPercent: number;
  corsiaEligible: boolean;
  notes: string;
}

@Injectable()
export class EligibleFuelsService {
  private readonly fuels: EligibleFuel[] = [
    {
      code: 'JET_A',
      name: 'Conventional Jet A / Jet A-1',
      lifecycleReductionPercent: 0,
      corsiaEligible: false,
      notes: 'Conventional baseline fuel.',
    },
    {
      code: 'SAF_HEFA',
      name: 'HEFA Sustainable Aviation Fuel',
      lifecycleReductionPercent: 60,
      corsiaEligible: true,
      notes:
        'Typical lifecycle reduction range under CORSIA-approved pathways.',
    },
    {
      code: 'SAF_ATJ',
      name: 'Alcohol-to-Jet Sustainable Aviation Fuel',
      lifecycleReductionPercent: 50,
      corsiaEligible: true,
      notes: 'Lifecycle reduction depends on feedstock and process chain.',
    },
    {
      code: 'SAF_FT',
      name: 'Fischer-Tropsch Sustainable Aviation Fuel',
      lifecycleReductionPercent: 70,
      corsiaEligible: true,
      notes:
        'Includes biomass-based FT pathways meeting sustainability criteria.',
    },
  ];

  listEligibleFuels() {
    return this.fuels;
  }

  getFuelAdjustmentFactor(fuelType: string): number {
    const normalizedFuel = fuelType.trim().toUpperCase();
    const fuel = this.fuels.find((entry) => entry.code === normalizedFuel);

    if (!fuel) {
      return 1;
    }

    return 1 - fuel.lifecycleReductionPercent / 100;
  }
}
