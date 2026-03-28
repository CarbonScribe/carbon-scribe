import { IsString, IsInt, Min } from 'class-validator';

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
