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

export class CreateScheduleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['scope1', 'scope2', 'scope3', 'corporate', 'events', 'product'])
  purpose: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsIn(['automatic', 'specific', 'portfolio-only'])
  creditSelection: 'automatic' | 'specific' | 'portfolio-only';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  creditIds?: string[];

  @IsIn(['monthly', 'quarterly', 'annual', 'one-time'])
  frequency: 'monthly' | 'quarterly' | 'annual' | 'one-time';

  @IsOptional()
  @IsInt()
  @Min(1)
  interval?: number;

  @IsDateString()
  startDate: string;

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
