import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export class CreateTargetDto {
  @IsString()
  companyId: string;

  @IsEnum(['NEAR_TERM', 'LONG_TERM', 'NET_ZERO'])
  targetType: string;

  @IsEnum(['SCOPE1', 'SCOPE2', 'SCOPE3', 'ALL'])
  scope: string;

  @IsNumber()
  baseYear: number;

  @IsNumber()
  baseYearEmissions: number;

  @IsNumber()
  targetYear: number;

  @IsNumber()
  reductionPercentage: number;

  @IsString()
  @IsOptional()
  status?: string;
}
