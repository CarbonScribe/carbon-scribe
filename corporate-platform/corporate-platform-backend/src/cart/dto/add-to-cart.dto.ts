import { IsString, IsInt, IsOptional, Min } from 'class-validator';

export class AddToCartDto {
  @IsString()
  creditId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number = 1000; // Default lot size in tCO₂
}
