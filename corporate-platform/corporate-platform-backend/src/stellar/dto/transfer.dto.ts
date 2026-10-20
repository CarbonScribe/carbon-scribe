import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class InitiateTransferDto {
  @IsString()
  purchaseId: string;

  @IsString()
  companyId: string;

  @IsString()
  projectId: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsString()
  contractId: string;

  @IsString()
  fromAddress: string;

  @IsString()
  toAddress: string;
}

export class BatchTransferDto {
  transfers: InitiateTransferDto[];
}

export class TransferHistoryQueryDto {
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
  @IsIn(['FAILED', 'SUBMITTED', 'PENDING', 'CONFIRMED'])
  status?: 'FAILED' | 'SUBMITTED' | 'PENDING' | 'CONFIRMED';

  @IsOptional()
  @IsString()
  walletAddress?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsISO8601()
  fromDate?: string;

  @IsOptional()
  @IsISO8601()
  toDate?: string;
}
