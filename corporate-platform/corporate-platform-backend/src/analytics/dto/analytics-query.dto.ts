import { IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  period?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  projectType?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsNumber()
  offset?: number;
}

export class DateRangeDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

export class ProjectComparisonDto {
  @IsString()
  projectId1: string;

  @IsString()
  projectId2: string;

  @IsOptional()
  @IsString({ each: true })
  metrics?: string[];
}

export class ChartDataDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
