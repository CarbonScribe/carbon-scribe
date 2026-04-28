import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  IsDateString,
} from 'class-validator';

export class CreateEmissionSourceDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  scope: number;

  @IsString()
  category: string;

  @IsString()
  name: string;

  @IsString()
  activityType: string;

  @IsString()
  unit: string;

  @IsOptional()
  @IsString()
  methodology?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RecordEmissionDto {
  @IsString()
  sourceId: string;

  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  activityValue: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  factorSource?: string;

  @IsOptional()
  @IsString()
  methodology?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  renewableEnergyPercentage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  transmissionLossFactor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  emissionFactorOverride?: number;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CalculateEmissionDto extends RecordEmissionDto {}
