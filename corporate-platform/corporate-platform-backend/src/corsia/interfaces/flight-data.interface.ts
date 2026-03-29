export interface FlightData {
  companyId: string;
  flightNumber: string;
  departureICAO: string;
  arrivalICAO: string;
  departureDate: Date;
  aircraftType: string;
  fuelBurn: number;
  fuelType: string;
  distance: number;
  passengerLoad?: number;
  cargoLoad?: number;
  metadata?: Record<string, unknown>;
}
