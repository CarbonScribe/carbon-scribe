import { ComplianceFramework, EntityType } from '../dto/check-compliance.dto';
import { ComplianceStatus } from '../dto/compliance-status.dto';
import {
  ComplianceIssue,
  ComplianceRequirement,
} from '../dto/compliance-report.dto';

export interface IComplianceValidator {
  validateCBam(entityId: string, metadata?: any): Promise<ValidationResult>;
  validateCorsia(entityId: string, metadata?: any): Promise<ValidationResult>;
  validateArticle6(entityId: string, metadata?: any): Promise<ValidationResult>;
  validateSBTi(entityId: string, metadata?: any): Promise<ValidationResult>;
  validateCDP(entityId: string, metadata?: any): Promise<ValidationResult>;
  validateGRI(entityId: string, metadata?: any): Promise<ValidationResult>;
  validateCSRD(entityId: string, metadata?: any): Promise<ValidationResult>;
  validateTCFD(entityId: string, metadata?: any): Promise<ValidationResult>;
}

export interface ValidationResult {
  framework: ComplianceFramework;
  entityId: string;
  entityType: EntityType;
  status: ComplianceStatus;
  issues: ComplianceIssue[];
  requirements: ComplianceRequirement[];
  recommendations: string[];
  timestamp: Date;
}
