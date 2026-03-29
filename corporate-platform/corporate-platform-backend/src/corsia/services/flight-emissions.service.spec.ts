import { FlightEmissionsService } from './flight-emissions.service';
import { EligibleFuelsService } from './eligible-fuels.service';

describe('FlightEmissionsService', () => {
  const service = new FlightEmissionsService(new EligibleFuelsService());

  it('calculates baseline emissions for conventional fuel', () => {
    const result = service.calculateCo2Emissions({
      companyId: 'company-1',
      flightNumber: 'CS101',
      departureICAO: 'DNMM',
      arrivalICAO: 'EGLL',
      departureDate: new Date('2026-01-01T10:00:00.000Z'),
      aircraftType: 'B787',
      fuelBurn: 10,
      fuelType: 'JET_A',
      distance: 5000,
    });

    expect(result).toBe(31.6);
  });

  it('applies SAF adjustment factor', () => {
    const result = service.calculateCo2Emissions({
      companyId: 'company-1',
      flightNumber: 'CS102',
      departureICAO: 'DNMM',
      arrivalICAO: 'HECA',
      departureDate: new Date('2026-01-01T10:00:00.000Z'),
      aircraftType: 'A320',
      fuelBurn: 10,
      fuelType: 'SAF_HEFA',
      distance: 3000,
    });

    expect(result).toBeCloseTo(12.64, 3);
  });
});
