import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class PlaceBidDto {
  @IsNumber()
  @Min(0)
  bidPrice: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  idempotencyKey?: string;
}
