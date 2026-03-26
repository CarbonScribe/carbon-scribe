import {
  IsString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsEnum,
} from 'class-validator';
import {
  OperationType,
  TransactionStatus,
} from '../interfaces/webhook.interface';

export class StellarWebhookDto {
  @IsString()
  @IsNotEmpty()
  transactionHash: string;

  @IsEnum(TransactionStatus)
  status: TransactionStatus;

  @IsEnum(OperationType)
  operationType: OperationType;

  @IsString()
  @IsNotEmpty()
  companyId: string;

  @IsOptional()
  @IsObject()
  metadata?: any;

  @IsOptional()
  ledgerSequence?: number;
}

export class TransactionStatusResponseDto {
  transactionHash: string;
  status: TransactionStatus;
  confirmations: number;
  finalizedAt?: Date;
}
