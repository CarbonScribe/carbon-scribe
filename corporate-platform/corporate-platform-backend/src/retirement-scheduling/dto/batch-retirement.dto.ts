import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BatchRetirementItemDto {
  @IsString()
  creditId: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsIn(['scope1', 'scope2', 'scope3', 'corporate', 'events', 'product'])
  purpose: string;

  @IsOptional()
  @IsString()
  purposeDetails?: string;
}

export class BatchRetirementDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchRetirementItemDto)
  items: BatchRetirementItemDto[];
}
