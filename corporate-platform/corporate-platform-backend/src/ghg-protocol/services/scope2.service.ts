import { Injectable } from '@nestjs/common';

@Injectable()
export class Scope2Service {
  calculate(input: {
    activityValue: number;
    emissionFactor: number;
    methodology?: string;
    renewableEnergyPercentage?: number;
    transmissionLossFactor?: number;
  }) {
    const methodology = (input.methodology || 'LOCATION_BASED').toUpperCase();
    const renewableShare = Math.min(
      Math.max(input.renewableEnergyPercentage ?? 0, 0),
      100,
    );
    const transmissionLossFactor = input.transmissionLossFactor ?? 1;
    const baseCo2e = input.activityValue * input.emissionFactor;
    const renewableAdjustment =
      methodology === 'MARKET_BASED' ? 1 - renewableShare / 100 : 1;
    const co2e = Number(
      (baseCo2e * renewableAdjustment * transmissionLossFactor).toFixed(6),
    );

    return {
      methodology:
        methodology === 'MARKET_BASED'
          ? 'GHG Protocol Scope 2 market-based'
          : 'GHG Protocol Scope 2 location-based',
      co2e,
      details: {
        renewableEnergyPercentage: renewableShare,
        transmissionLossFactor,
      },
    };
  }
}
