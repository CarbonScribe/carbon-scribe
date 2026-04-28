export interface EmissionSourceDefinition {
  id: string;
  companyId: string;
  scope: 1 | 2 | 3;
  category: string;
  name: string;
  activityType: string;
  unit: string;
  methodology?: string | null;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
}
