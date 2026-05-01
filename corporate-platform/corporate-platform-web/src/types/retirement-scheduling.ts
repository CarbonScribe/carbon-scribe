export type RetirementPurpose =
  | 'scope1'
  | 'scope2'
  | 'scope3'
  | 'corporate'
  | 'events'
  | 'product';

export type CreditSelectionMode = 'automatic' | 'specific' | 'portfolio-only';

export type ScheduleFrequency = 'monthly' | 'quarterly' | 'annual' | 'one-time';

export interface ScheduledRetirement {
  id: string;
  companyId: string;
  userId: string;
  name: string;
  description?: string | null;
  purpose: RetirementPurpose;
  amount: number;
  creditSelection: CreditSelectionMode;
  creditIds: string[];
  frequency: ScheduleFrequency;
  interval?: number | null;
  startDate: string;
  endDate?: string | null;
  nextRunDate: string;
  timezone?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunDate?: string | null;
  lastRunStatus?: string | null;
  runCount: number;
  notifyBefore?: number | null;
  notifyAfter: boolean;
}

export interface ScheduleExecution {
  id: string;
  scheduleId: string;
  runAt: string;
  completedAt?: string | null;
  status: string;
  error?: string | null;
  createdAt: string;
  scheduledDate?: string | null;
  executedDate?: string | null;
  amountRetired?: number | null;
  retirementIds: string[];
  errorMessage?: string | null;
  retryCount: number;
  nextRetryDate?: string | null;
}

export interface ScheduledRetirementDetails extends ScheduledRetirement {
  executions?: ScheduleExecution[];
}

export interface CreateScheduledRetirementPayload {
  name: string;
  description?: string;
  purpose: RetirementPurpose;
  amount: number;
  creditSelection: CreditSelectionMode;
  creditIds?: string[];
  frequency: ScheduleFrequency;
  interval?: number;
  startDate: string;
  endDate?: string;
  notifyBefore?: number;
  notifyAfter?: boolean;
}

export type UpdateScheduledRetirementPayload = Partial<
  CreateScheduledRetirementPayload
>;
