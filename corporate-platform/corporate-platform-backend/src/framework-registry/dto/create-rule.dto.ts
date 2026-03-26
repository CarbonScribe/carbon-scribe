import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateMappingRuleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsIn(['REGISTRY', 'METHODOLOGY_TYPE', 'AUTHORITY', 'KEYWORD'])
  conditionType: 'REGISTRY' | 'METHODOLOGY_TYPE' | 'AUTHORITY' | 'KEYWORD';

  @IsString()
  conditionValue: string;

  @IsString()
  targetFramework: string;

  @IsArray()
  @IsString({ each: true })
  targetRequirements: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMappingRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  conditionType?: 'REGISTRY' | 'METHODOLOGY_TYPE' | 'AUTHORITY' | 'KEYWORD';

  @IsOptional()
  @IsString()
  conditionValue?: string;

  @IsOptional()
  @IsString()
  targetFramework?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetRequirements?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
