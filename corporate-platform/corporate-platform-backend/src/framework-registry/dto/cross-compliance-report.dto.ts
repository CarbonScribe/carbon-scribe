import { IsArray, IsOptional, IsString } from 'class-validator';

export class CrossComplianceReportQueryDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  frameworkCodes?: string[];

  @IsOptional()
  @IsString()
  companyId?: string;
}

export class FrameworkCoverage {
  frameworkCode: string;
  frameworkName: string;
  totalRequirements: number;
  mappedRequirements: number;
  coveragePercentage: number;
  unmappedRequirements: string[];
}

export class CrossComplianceReportDto {
  companyId: string;
  generatedAt: Date;
  overallCoverage: number;
  frameworkCoverages: FrameworkCoverage[];
}
