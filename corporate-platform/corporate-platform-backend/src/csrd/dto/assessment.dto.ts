import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateMaterialityAssessmentDto {
  @IsNotEmpty()
  @IsInt()
  assessmentYear: number;

  @IsNotEmpty()
  @IsObject()
  impacts: any;

  @IsNotEmpty()
  @IsObject()
  risks: any;

  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class UpdateMaterialityAssessmentDto extends CreateMaterialityAssessmentDto {
  @IsNotEmpty()
  @IsString()
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
}
