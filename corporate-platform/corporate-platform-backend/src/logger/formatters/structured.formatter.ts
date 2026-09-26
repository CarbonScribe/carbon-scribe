import { LogEntry } from '../interfaces/log-entry.interface';

export interface StructuredLogEntry extends LogEntry {
  traceId?: string;
  spanId?: string;
  workflowStage?: string;
  step?: number;
  domainFields?: Record<string, any>;
  apiVersion?: string;
  userAgent?: string;
  referer?: string;
  errorCode?: string;
  causedBy?: string;
  sampling?: {
    sampled: boolean;
    sampleRate: number;
  };
}

export function formatStructured(entry: LogEntry): string {
  const structured = entry as StructuredLogEntry;

  // Ensure all fields are included
  const output: Record<string, any> = {
    timestamp: entry.timestamp,
    level: entry.level,
    service: entry.service,
    environment: entry.environment,
    message: entry.message,
  };

  // Add optional fields if present
  if (entry.requestId) output.requestId = entry.requestId;
  if (entry.userId) output.userId = entry.userId;
  if (entry.companyId) output.companyId = entry.companyId;
  if (entry.ip) output.ip = entry.ip;
  if (entry.method) output.method = entry.method;
  if (entry.path) output.path = entry.path;
  if (entry.statusCode) output.statusCode = entry.statusCode;
  if (entry.duration) output.duration = entry.duration;

  // Add new structured fields
  if (structured.traceId) output.traceId = structured.traceId;
  if (structured.spanId) output.spanId = structured.spanId;
  if (structured.workflowStage) output.workflowStage = structured.workflowStage;
  if (structured.step !== undefined) output.step = structured.step;
  if (structured.domainFields) output.domainFields = structured.domainFields;
  if (structured.apiVersion) output.apiVersion = structured.apiVersion;
  if (structured.userAgent) output.userAgent = structured.userAgent;
  if (structured.referer) output.referer = structured.referer;
  if (structured.errorCode) output.errorCode = structured.errorCode;
  if (structured.causedBy) output.causedBy = structured.causedBy;
  if (structured.sampling) output.sampling = structured.sampling;

  // Handle error object
  if (entry.error) {
    output.error = {
      name: entry.error.name,
      message: entry.error.message,
    };
    if (entry.error.stack) {
      output.error.stack = entry.error.stack;
    }
    if (entry.error.code) {
      output.error.code = entry.error.code;
    }
  }

  // Handle metadata
  if (entry.metadata) {
    output.metadata = entry.metadata;
  }

  return JSON.stringify(output);
}
