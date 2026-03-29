import { Injectable } from '@nestjs/common';
import { FlightData } from '../interfaces/flight-data.interface';
import { EligibleFuelsService } from './eligible-fuels.service';

@Injectable()
export class FlightEmissionsService {
  // Simplified CORSIA-aligned default fuel-to-CO2 conversion factors (tCO2 / tonne fuel).
  private readonly baseFuelFactors: Record<string, number> = {
    JET_A: 3.16,
    JET_A1: 3.16,
    AVGAS: 3.1,
    JP8: 3.16,
  };

  constructor(private readonly eligibleFuelsService: EligibleFuelsService) {}

  calculateCo2Emissions(flight: FlightData): number {
    const fuelType = flight.fuelType.trim().toUpperCase();
    const baseFactor =
      this.baseFuelFactors[fuelType] ?? this.baseFuelFactors.JET_A;
    const safAdjustment =
      this.eligibleFuelsService.getFuelAdjustmentFactor(fuelType);

    // Additional operational factor can be adjusted over time to capture uplift/unaccounted losses.
    const operationalFactor = 1;
    const total =
      flight.fuelBurn * baseFactor * safAdjustment * operationalFactor;

    return Number(total.toFixed(6));
  }
}
