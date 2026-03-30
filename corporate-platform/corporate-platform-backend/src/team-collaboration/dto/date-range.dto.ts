import { IsNotEmpty, IsDate, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class DateRangeDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  periodStart?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  periodEnd?: Date;
}

export class PaginatedQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

export class MemberIdDto {
  @IsNotEmpty()
  @Type(() => String)
  id: string;
}
