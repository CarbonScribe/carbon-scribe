import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextData {
  requestId: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  companyId?: string;
  tenantId?: string;
  userEmail?: string;
  userRole?: string;
  ip?: string;
  userAgent?: string;
  referer?: string;
  method?: string;
  path?: string;
  apiVersion?: string;
  workflowStage?: string;
  step?: number;
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
  };
}

export class RequestContext {
  private static als = new AsyncLocalStorage<RequestContextData>();

  static run(context: RequestContextData, callback: () => void): void {
    this.als.run(context, callback);
  }

  static get(): RequestContextData | undefined {
    return this.als.getStore();
  }

  static getRequestId(): string | undefined {
    return this.get()?.requestId;
  }

  static getTraceId(): string | undefined {
    return this.get()?.traceId;
  }

  static getSpanId(): string | undefined {
    return this.get()?.spanId;
  }

  static getUserId(): string | undefined {
    return this.get()?.userId;
  }

  static getCompanyId(): string | undefined {
    return this.get()?.companyId;
  }

  static getWorkflowStage(): string | undefined {
    return this.get()?.workflowStage;
  }

  static setWorkflowStage(stage: string, step?: number): void {
    const context = this.get();
    if (context) {
      context.workflowStage = stage;
      if (step !== undefined) {
        context.step = step;
      }
    }
  }

  static setDomainFields(fields: RequestContextData['domainFields']): void {
    const context = this.get();
    if (context) {
      context.domainFields = { ...context.domainFields, ...fields };
    }
  }

  static addDomainField<
    K extends keyof NonNullable<RequestContextData['domainFields']>,
  >(key: K, value: string): void {
    const context = this.get();
    if (context) {
      if (!context.domainFields) {
        context.domainFields = {};
      }
      context.domainFields[key] = value;
    }
  }

  static getDomainFields(): RequestContextData['domainFields'] {
    return this.get()?.domainFields || {};
  }
}
