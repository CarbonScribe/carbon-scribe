import { IsOptional, IsString, IsNumber, IsArray } from 'class-validator';

export class CreditQueryDto {
  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  limit?: number = 20;

  @IsOptional()
  @IsString()
  methodology?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsNumber()
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @IsNumber()
  vintage?: number;

  @IsOptional()
  @IsArray()
  sdgs?: number[];

  @IsOptional()
  @IsString()
  sort?: string; // e.g. price_asc, score_desc

  @IsOptional()
  @IsString()
  search?: string;
}
