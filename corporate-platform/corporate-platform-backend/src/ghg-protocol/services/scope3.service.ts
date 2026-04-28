import { Injectable } from '@nestjs/common';

@Injectable()
export class Scope3Service {
  calculate(input: {
    activityValue: number;
    emissionFactor: number;
    category: string;
  }) {
    const co2e = Number(
      (input.activityValue * input.emissionFactor).toFixed(6),
    );

    return {
      methodology: `GHG Protocol Scope 3 category-based (${input.category})`,
      co2e,
      details: {
        category: input.category,
      },
    };
  }
}
