import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
} from 'class-validator';

export class VerifyIntegrityDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  ids: string[];

  @IsOptional()
  @IsString()
  companyId?: string;
}
