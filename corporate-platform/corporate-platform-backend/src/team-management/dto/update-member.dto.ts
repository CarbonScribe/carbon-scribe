import {
  IsOptional,
  IsString,
  IsObject,
  IsIn,
  MaxLength,
} from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'PENDING'])
  status?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}
