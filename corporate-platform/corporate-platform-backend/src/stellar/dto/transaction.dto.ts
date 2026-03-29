import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray, IsNumber, IsObject } from 'class-validator';
import { TransactionStatus, OperationType } from '../interfaces/stellar.interface';

export class TransactionSubmitDto {
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  walletId: string;

  @IsString()
  @IsNotEmpty()
  transactionHash: string;

  @IsEnum(OperationType)
  @IsNotEmpty()
  operationType: OperationType;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsArray()
  @IsNumber({}, { each: true })
  tokenIds: number[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class TransactionResponseDto {
  id: string;
  companyId: string;
  walletId: string;
  transactionHash: string;
  operationType: OperationType;
  status: TransactionStatus;
  amount: number;
  tokenIds: number[];
  submittedAt: Date;
  confirmedAt?: Date;
  metadata?: Record<string, unknown>;
}

export class TransactionStatusUpdateDto {
  @IsEnum(TransactionStatus)
  @IsNotEmpty()
  status: TransactionStatus;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}
