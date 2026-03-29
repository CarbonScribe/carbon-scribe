import { IsInt, Max, Min } from 'class-validator';

export class ComplianceYearDto {
  @IsInt()
  @Min(2016)
  @Max(2100)
  year: number;
}
