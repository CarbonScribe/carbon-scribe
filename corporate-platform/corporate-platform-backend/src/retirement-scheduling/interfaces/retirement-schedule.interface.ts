export type ScheduleFrequency = 'monthly' | 'quarterly' | 'annual' | 'one-time';

export type CreditSelectionMode = 'automatic' | 'specific' | 'portfolio-only';

export type ScheduleRunStatus = 'success' | 'failed' | 'partial';

export interface RetirementScheduleLike {
  id: string;
  companyId: string;
  createdBy: string;
  name: string;
  description?: string | null;
  purpose: string;
  amount: number;
  creditSelection: CreditSelectionMode;
  creditIds: string[];
  frequency: ScheduleFrequency;
  interval?: number | null;
  startDate: Date;
  endDate?: Date | null;
  nextRunDate: Date;
  isActive: boolean;
  lastRunDate?: Date | null;
  lastRunStatus?: ScheduleRunStatus | null;
  runCount: number;
  notifyBefore?: number | null;
  notifyAfter: boolean;
  createdAt: Date;
  updatedAt: Date;
}
