import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray, IsNumber, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionStatus, OperationType } from '../interfaces/stellar.interface';

export class TransactionSubmitDto {
  @ApiProperty({ description: 'Company ID' })
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @ApiProperty({ description: 'Wallet ID' })
  @IsString()
  @IsNotEmpty()
  walletId: string;

  @ApiProperty({ description: 'Stellar transaction hash' })
  @IsString()
  @IsNotEmpty()
  transactionHash: string;

  @ApiProperty({ enum: OperationType, description: 'Type of operation' })
  @IsEnum(OperationType)
  @IsNotEmpty()
  operationType: OperationType;

  @ApiProperty({ description: 'Amount of credits/tokens' })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ description: 'Token IDs involved', type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  tokenIds: number[];

  @ApiProperty({ description: 'Additional metadata', required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class TransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  companyId: string;

  @ApiProperty()
  walletId: string;

  @ApiProperty()
  transactionHash: string;

  @ApiProperty({ enum: OperationType })
  operationType: OperationType;

  @ApiProperty({ enum: TransactionStatus })
  status: TransactionStatus;

  @ApiProperty()
  amount: number;

  @ApiProperty({ type: [Number] })
  tokenIds: number[];

  @ApiProperty()
  submittedAt: Date;

  @ApiProperty({ required: false })
  confirmedAt?: Date;

  @ApiProperty({ required: false })
  metadata?: Record<string, unknown>;
}

export class TransactionStatusUpdateDto {
  @ApiProperty({ enum: TransactionStatus, description: 'New transaction status' })
  @IsEnum(TransactionStatus)
  @IsNotEmpty()
  status: TransactionStatus;

  @ApiProperty({ description: 'Error message if failed', required: false })
  @IsOptional()
  @IsString()
  errorMessage?: string;
}
