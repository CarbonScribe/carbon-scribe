import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateScheduleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['scope1', 'scope2', 'scope3', 'corporate', 'events', 'product'])
  purpose?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsIn(['automatic', 'specific', 'portfolio-only'])
  creditSelection?: 'automatic' | 'specific' | 'portfolio-only';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  creditIds?: string[];

  @IsOptional()
  @IsIn(['monthly', 'quarterly', 'annual', 'one-time'])
  frequency?: 'monthly' | 'quarterly' | 'annual' | 'one-time';

  @IsOptional()
  @IsInt()
  @Min(1)
  interval?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  notifyBefore?: number;

  @IsOptional()
  @IsBoolean()
  notifyAfter?: boolean;
}
