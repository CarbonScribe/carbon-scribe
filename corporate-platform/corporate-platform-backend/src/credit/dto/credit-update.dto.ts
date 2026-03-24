import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreditUpdateDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  availableAmount?: number;
}
