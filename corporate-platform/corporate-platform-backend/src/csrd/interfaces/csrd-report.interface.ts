export interface CsrdReportDataPoint {
  key: string;
  value: unknown;
  unit?: string;
  assuranceLevel?: string;
}

export interface CsrdReportSection {
  standard: string;
  disclosureRequirement: string;
  dataPoints: CsrdReportDataPoint[];
}

export interface CsrdReportMetadata {
  auditorName?: string;
  auditFirm?: string;
  isExternalAssured: boolean;
  customChapters?: string[];
  tags?: string[];
  generatedAt?: Date;
  format?: string;
  totalDisclosures?: number;
  standardsCovered?: string[];
}

export interface CsrdReportStructure {
  companyId: string;
  reportingYear: number;
  sections: CsrdReportSection[];
  materialityMatrix?: unknown;
  ghgInventory?: unknown;
  metadata: CsrdReportMetadata;
}
