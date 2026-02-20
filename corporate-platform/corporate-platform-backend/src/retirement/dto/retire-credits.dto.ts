import { IsString, IsInt, IsEnum, IsOptional, Min } from 'class-validator';

export class RetireCreditsDto {
  @IsString()
  creditId: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsEnum(['scope1', 'scope2', 'scope3', 'corporate', 'events', 'product'])
  purpose: string;

  @IsOptional()
  @IsString()
  purposeDetails?: string;
}
