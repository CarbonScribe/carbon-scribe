import {
  IsOptional,
  IsDateString,
  IsString,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';

export class PortfolioQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  methodology?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @IsOptional()
  @IsEnum(['monthly', 'quarterly', 'yearly'])
  aggregation?: string = 'monthly';
}
