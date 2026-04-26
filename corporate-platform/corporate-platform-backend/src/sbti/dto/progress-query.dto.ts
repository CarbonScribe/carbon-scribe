import { IsString, IsNumber } from 'class-validator';

export class ProgressQueryDto {
  @IsString()
  targetId: string;

  @IsNumber()
  reportingYear: number;
}
