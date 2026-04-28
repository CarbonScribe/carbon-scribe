export interface EmissionFactorDefinition {
  id: string;
  source: string;
  activityType: string;
  unit: string;
  co2ePerUnit: number;
  validFrom: Date;
  validTo?: Date | null;
  region: string;
  methodology?: string | null;
  isActive: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface EmissionFactorLookup {
  activityType: string;
  unit: string;
  region?: string;
  asOfDate: Date;
  preferredSource?: string;
}
