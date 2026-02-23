import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export enum CreditStatus {
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  RETIRED = 'retired',
  PENDING = 'pending',
}

export class CreditUpdateDto {
  @IsOptional()
  @IsEnum(CreditStatus)
  status?: CreditStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  availableAmount?: number;
}
