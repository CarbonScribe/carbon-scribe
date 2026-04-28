import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RetirementVerificationDto {
  @IsString()
  txHash: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;
}

export class RetirementProofDto {
  @IsString()
  txHash: string;
}
