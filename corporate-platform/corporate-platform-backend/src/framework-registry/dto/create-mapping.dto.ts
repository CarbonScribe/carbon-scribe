import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsObject,
  IsBoolean,
  IsIn,
} from 'class-validator';

export class CreateMappingDto {
  @IsString()
  frameworkId: string;

  @IsString()
  methodologyId: string;

  @IsInt()
  methodologyTokenId: number;

  @IsArray()
  @IsString({ each: true })
  requirementIds: string[];

  @IsString()
  @IsIn(['AUTO', 'MANUAL', 'SYSTEM'])
  mappingType: 'AUTO' | 'MANUAL' | 'SYSTEM';

  @IsOptional()
  @IsObject()
  metadata?: any;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMappingDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirementIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: any;
}
