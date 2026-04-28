import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  IN_PROGRESS = 'in_progress',
  NOT_STARTED = 'not_started',
  NON_COMPLIANT = 'non_compliant',
  PENDING_REVIEW = 'pending_review',
}

export class ComplianceStatusDto {
  @IsString()
  @IsNotEmpty()
  entityId: string;

  @IsString()
  @IsNotEmpty()
  framework: string;

  @IsEnum(ComplianceStatus)
  @IsNotEmpty()
  status: ComplianceStatus;

  @IsString()
  reason?: string;

  dueDate?: Date;

  completedAt?: Date;
}
