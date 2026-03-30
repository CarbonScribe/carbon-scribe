import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsOptional,
} from 'class-validator';

export class GenerateReportDto {
  @IsInt()
  @Min(2023)
  year: number;

  @IsInt()
  @Min(1)
  @Max(4)
  quarter: number;
}

export class SubmitReportDto {
  @IsString()
  @IsNotEmpty()
  reportId: string;

  @IsOptional()
  @IsString()
  submissionNotes?: string;
}

export class CalculateEmissionsDto {
  @IsString()
  @IsNotEmpty()
  goodsId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  quantityUnit: string;

  @IsString()
  @IsNotEmpty()
  countryOfOrigin: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualEmissions?: number;

  @IsOptional()
  @IsString()
  installationId?: string;
}
