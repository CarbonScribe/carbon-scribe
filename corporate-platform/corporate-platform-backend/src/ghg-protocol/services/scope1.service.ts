import { Injectable } from '@nestjs/common';

@Injectable()
export class Scope1Service {
  calculate(input: {
    activityValue: number;
    emissionFactor: number;
    oxidationFactor?: number;
  }) {
    const oxidationFactor = input.oxidationFactor ?? 1;
    const co2e = Number(
      (input.activityValue * input.emissionFactor * oxidationFactor).toFixed(6),
    );

    return {
      methodology: 'GHG Protocol Scope 1 direct emissions',
      co2e,
      details: {
        oxidationFactor,
      },
    };
  }
}
