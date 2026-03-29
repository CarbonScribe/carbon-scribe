import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DateRangeDto } from './date-range.dto';

export class TransactionQueryDto extends DateRangeDto {
  @IsOptional()
  @IsEnum(['order', 'refund', 'adjustment', 'transfer', 'retirement'])
  type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
