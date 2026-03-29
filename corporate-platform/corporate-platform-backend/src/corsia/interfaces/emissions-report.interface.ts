export interface EmissionsReportSummary {
  companyId: string;
  year: number;
  totalFlights: number;
  totalFuelBurnTonnes: number;
  totalEmissionsTonnes: number;
  baselineEmissionsTonnes: number;
  offsetRequirementTonnes: number;
  offsetsRetiredTonnes: number;
  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
}

export interface EmissionsReportSection {
  title: string;
  description: string;
  data: Record<string, unknown>;
}

export interface EmissionsReport {
  id: string;
  format: 'ICAO_CORSIA_JSON';
  generatedAt: string;
  summary: EmissionsReportSummary;
  sections: EmissionsReportSection[];
}
