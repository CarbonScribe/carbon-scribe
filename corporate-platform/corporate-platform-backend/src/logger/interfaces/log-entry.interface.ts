export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  service: string;
  environment: string;
  message: string;

  // Request context
  requestId?: string;
  userId?: string;
  companyId?: string;
  ip?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;

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
    [key: string]: string | undefined;
  };

  // Additional context
  apiVersion?: string;
  userAgent?: string;
  referer?: string;

  // Error
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };

  // Error enrichment
  errorCode?: string;
  causedBy?: string;

  // Sampling
  sampling?: {
    sampled: boolean;
    sampleRate: number;
  };

  // Metadata
  metadata?: Record<string, any>;

  // Request/response bodies (development only)
  requestBody?: any;
  responseBody?: any;
}
