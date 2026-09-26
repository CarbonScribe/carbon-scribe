import { LogEntry } from './log-entry.interface';

export interface ExtendedLogEntry extends LogEntry {
  // Distributed tracing
  traceId?: string;
  spanId?: string;

  // Workflow tracking
  workflowStage?: string;
  step?: number;

  // Domain-specific fields
  domainFields?: {
    creditId?: string;
    retirementId?: string;
    orderId?: string;
    auctionId?: string;
    certificateId?: string;
    transactionHash?: string;
    projectId?: string;
    complianceReportId?: string;
    assessmentId?: string;
    contractId?: string;
    companyTargetId?: string;
  };

  // Additional context
  apiVersion?: string;
  userAgent?: string;
  referer?: string;

  // Error enrichment
  errorCode?: string;
  causedBy?: string;

  // Sampling
  sampling?: {
    sampled: boolean;
    sampleRate: number;
  };

  // Request/response bodies (development only)
  requestBody?: any;
  responseBody?: any;
}
