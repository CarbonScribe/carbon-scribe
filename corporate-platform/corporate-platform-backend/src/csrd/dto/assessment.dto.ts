import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MaterialityTopicDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEnum(['environmental', 'social', 'governance'])
  category: 'environmental' | 'social' | 'governance';

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  impactScore: number;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  financialScore: number;

  @IsNotEmpty()
  @IsString()
  justification: string;

  @IsOptional()
  @IsString()
  relatedStandard?: string;
}

export class CreateMaterialityAssessmentDto {
  @IsNotEmpty()
  @IsInt()
  assessmentYear: number;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialityTopicDto)
  impacts: MaterialityTopicDto[];

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialityTopicDto)
  risks: MaterialityTopicDto[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateMaterialityAssessmentDto {
  @IsNotEmpty()
  @IsString()
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialityTopicDto)
  impacts?: MaterialityTopicDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialityTopicDto)
  risks?: MaterialityTopicDto[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
