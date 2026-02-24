import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PaginationDto } from './pagination.dto';
import {
  MarketplaceSortBy,
  MarketplaceSortOrder,
} from '../interfaces/search-query.interface';

export class SearchQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  projectName?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  methodology?: string;

  @IsOptional()
  @IsString()
  standard?: string;

  @IsOptional()
  @IsArray()
  @Min(1, { each: true })
  @Max(17, { each: true })
  sdgs?: number[];

  @IsOptional()
  @IsNumber()
  vintageFrom?: number;

  @IsOptional()
  @IsNumber()
  vintageTo?: number;

  @IsOptional()
  @IsNumber()
  priceMin?: number;

  @IsOptional()
  @IsNumber()
  priceMax?: number;

  @IsOptional()
  @IsIn(['price', 'vintage', 'popularity', 'createdAt'])
  sortBy?: MarketplaceSortBy;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: MarketplaceSortOrder;
}
