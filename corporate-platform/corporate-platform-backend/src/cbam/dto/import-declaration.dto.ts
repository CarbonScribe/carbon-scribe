import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  IsObject,
} from 'class-validator';

export class ImportDeclarationDto {
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

  @IsDateString()
  importDate: string;

  @IsString()
  @IsNotEmpty()
  countryOfOrigin: string;

  @IsOptional()
  @IsString()
  installationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualEmissions?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
