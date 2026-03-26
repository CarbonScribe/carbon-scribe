import { IsInt, IsString } from 'class-validator';

export class ValidateMethodologyDto {
  @IsInt()
  methodologyTokenId: number;

  @IsString()
  frameworkCode: string;
}

export class ValidationResultDto {
  isValid: boolean;
  frameworkCode: string;
  methodologyTokenId: number;
  mappedRequirements: string[];
  missingRequirements: string[];
  reasons?: string[];
}
