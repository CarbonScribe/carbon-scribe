import {
  IsString,
  IsNumber,
  IsDateString,
  Min,
  IsPositive,
} from 'class-validator';

export class CreateAuctionDto {
  @IsString()
  creditId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsNumber()
  @IsPositive()
  startPrice: number;

  @IsNumber()
  @Min(0)
  floorPrice: number;

  @IsNumber()
  @IsPositive()
  priceDecrement: number;

  @IsNumber()
  @IsPositive()
  decrementInterval: number; // in minutes

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;
}
