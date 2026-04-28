export interface InventoryTotalsByScope {
  scope1: number;
  scope2: number;
  scope3: number;
}

export interface InventoryCategoryBreakdown {
  scope: number;
  category: string;
  totalCo2e: number;
  verifiedCo2e: number;
  recordCount: number;
}

export interface InventoryTrendPoint {
  period: string;
  totalCo2e: number;
  scope1: number;
  scope2: number;
  scope3: number;
}

export interface FrameworkRequirementStatus {
  id: string;
  name: string;
  description?: string;
  satisfied: boolean;
}

export interface FrameworkValidationSummary {
  frameworkCode: string | null;
  complianceStatus: string | null;
  requirements: FrameworkRequirementStatus[];
}

export interface EmissionsInventory {
  companyId: string;
  period: {
    start: string;
    end: string;
  };
  totalCo2e: number;
  verifiedCo2e: number;
  unverifiedCo2e: number;
  recordCount: number;
  totalsByScope: InventoryTotalsByScope;
  categories: InventoryCategoryBreakdown[];
  trends?: InventoryTrendPoint[];
  frameworkValidation?: FrameworkValidationSummary;
}
