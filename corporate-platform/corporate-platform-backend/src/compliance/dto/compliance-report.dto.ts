import { ComplianceFramework } from './check-compliance.dto';
import { ComplianceStatus } from './compliance-status.dto';

export class ComplianceCheckResultDto {
  framework: ComplianceFramework;
  entityId: string;
  entityType: string;
  status: ComplianceStatus;
  timestamp: Date;
  issues: ComplianceIssue[];
  requirements: ComplianceRequirement[];
  recommendations: string[];
}

export interface ComplianceIssue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  affectedArea: string;
  suggestedAction?: string;
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  status: 'met' | 'unmet' | 'pending';
  description: string;
  dueDate?: Date;
  priority: 'high' | 'medium' | 'low';
}

export class ComplianceReportDto {
  reportId: string;
  entityId: string;
  entityType: string;
  generatedAt: Date;
  frameworks: ComplianceFramework[];
  summaryStatus: ComplianceStatus;
  overallCompliance: number; // percentage 0-100
  frameworkReports: FrameworkReportDetail[];
  issues: ComplianceIssue[];
  recommendations: string[];
  nextReviewDate: Date;
  exportFormat?: 'pdf' | 'json' | 'csv';
}

export interface FrameworkReportDetail {
  framework: ComplianceFramework;
  status: ComplianceStatus;
  compliance: number; // percentage
  requirements: ComplianceRequirement[];
  issues: ComplianceIssue[];
}
