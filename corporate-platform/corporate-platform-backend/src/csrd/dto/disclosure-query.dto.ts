import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DisclosureQueryDto {
  @IsOptional()
  @IsString()
  reportingPeriod?: string;

  @IsOptional()
  @IsString()
  standard?: string;
}

export class RecordDisclosureDto {
  @IsNotEmpty()
  @IsString()
  reportingPeriod: string;

  @IsNotEmpty()
  @IsString()
  standard: string;

  @IsNotEmpty()
  @IsString()
  disclosureRequirement: string;

  @IsNotEmpty()
  @IsString()
  dataPoint: string;

  @IsNotEmpty()
  value: any;

  @IsOptional()
  @IsString()
  assuranceLevel?: 'LIMITED' | 'REASONABLE';
}
