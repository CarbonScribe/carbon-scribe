import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class SorobanEventValueDto {
  @IsString()
  @IsNotEmpty()
  xdr: string;
}

export class SorobanEventDto {
  @IsString()
  @IsNotEmpty()
  type: string;
  @IsNumber()
  ledger: number;
  @IsString()
  ledgerClosedAt: string;
  @IsString()
  @IsNotEmpty()
  id: string;
  @IsString()
  @IsNotEmpty()
  contractId: string;
  @IsArray()
  @IsString({ each: true })
  topic: string[];
  @ValidateNested()
  @Type(() => SorobanEventValueDto)
  value: {
    xdr: string;
  };
  @IsBoolean()
  inSuccessfulContractCall: boolean;
}
