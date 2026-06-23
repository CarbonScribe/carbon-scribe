import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CertificateFailureStatus } from '../interfaces/certificate-failure.interface';

/** Query parameters for listing dead-lettered certificate anchoring failures. */
export class CertificateFailureQueryDto {
  @IsOptional()
  @IsEnum(CertificateFailureStatus)
  status?: CertificateFailureStatus;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  retirementId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
