import { IsNumber, Min } from 'class-validator';

export class PlaceBidDto {
  @IsNumber()
  @Min(0)
  bidPrice: number;

  @IsNumber()
  @Min(1)
  quantity: number;
}
