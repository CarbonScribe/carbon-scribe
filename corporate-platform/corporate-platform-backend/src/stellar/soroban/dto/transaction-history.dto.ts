import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class TransactionHistoryQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  contractId?: string;

  @IsOptional()
  @IsIn(['PENDING', 'CONFIRMED', 'FAILED'])
  status?: 'PENDING' | 'CONFIRMED' | 'FAILED';
}
