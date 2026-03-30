import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SbtiScope, SbtiTargetType } from '../interfaces/sbti-target.interface';

export class CreateTargetDto {
  @IsEnum(['NEAR_TERM', 'LONG_TERM', 'NET_ZERO'], {
    message: 'targetType must be NEAR_TERM, LONG_TERM, or NET_ZERO',
  })
  @IsNotEmpty()
  targetType: SbtiTargetType;

  @IsEnum(['SCOPE1', 'SCOPE2', 'SCOPE3', 'ALL'], {
    message: 'scope must be SCOPE1, SCOPE2, SCOPE3, or ALL',
  })
  @IsNotEmpty()
  scope: SbtiScope;

  @Type(() => Number)
  @IsInt()
  @Min(1990)
  @Max(2030)
  baseYear: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseYearEmissions: number;

  @Type(() => Number)
  @IsInt()
  @Min(2025)
  @Max(2050)
  targetYear: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  reductionPercentage: number;
}
