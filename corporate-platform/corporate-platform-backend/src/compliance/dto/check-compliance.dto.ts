import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ComplianceFramework {
  GHG = 'GHG',
  CSRD = 'CSRD',
  CORSIA = 'CORSIA',
  CBAM = 'CBAM',
  SBTi = 'SBTi',
  CDP = 'CDP',
  GRI = 'GRI',
  TCFD = 'TCFD',
  ARTICLE_6 = 'ARTICLE_6',
}

export enum EntityType {
  CREDIT = 'CREDIT',
  TRANSACTION = 'TRANSACTION',
  PROJECT = 'PROJECT',
  USER = 'USER',
  COMPANY = 'COMPANY',
}

export class CheckComplianceDto {
  @IsEnum(ComplianceFramework)
  @IsNotEmpty()
  framework: ComplianceFramework;

  @IsEnum(EntityType)
  @IsNotEmpty()
  entityType: EntityType;

  @IsString()
  @IsNotEmpty()
  entityId: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  requirements?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  metadata?: Record<string, any>;
}
