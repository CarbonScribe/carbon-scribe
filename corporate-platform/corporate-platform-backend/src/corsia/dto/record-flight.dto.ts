import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RecordFlightDto {
  @IsString()
  @IsNotEmpty()
  flightNumber: string;

  @IsString()
  @IsNotEmpty()
  departureICAO: string;

  @IsString()
  @IsNotEmpty()
  arrivalICAO: string;

  @IsDateString()
  departureDate: string;

  @IsString()
  @IsNotEmpty()
  aircraftType: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fuelBurn: number;

  @IsString()
  @IsNotEmpty()
  fuelType: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distance: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  passengerLoad?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cargoLoad?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
