export interface CbamReportSummary {
  companyId: string;
  year: number;
  quarter: number;
  totalEmissions: number;
  certificatesRequired: number;
  totalImportValue: number;
  numberOfDeclarations: number;
}

export interface CbamReportStatus {
  status: 'DRAFT' | 'SUBMITTED' | 'ACCEPTED';
  submittedAt?: Date;
  submissionId?: string;
  acceptedAt?: Date;
}

export interface CbamReportData {
  summary: CbamReportSummary;
  declarations: ImportDeclarationData[];
  certificates: CertificateData[];
  calculations: EmissionsCalculationData[];
}

export interface ImportDeclarationData {
  id: string;
  goodsName: string;
  cnCode: string;
  quantity: number;
  countryOfOrigin: string;
  emissions: number;
  certificateCost?: number;
}

export interface CertificateData {
  certificatesPurchased: number;
  certificatesSurrendered: number;
  certificatesBalance: number;
  averagePrice: number;
}

export interface EmissionsCalculationData {
  goodsId: string;
  calculationMethod: string;
  actualEmissions: number | null;
  defaultEmissions: number;
  totalEmissions: number;
}

export interface CbamQuarterlyReport {
  id: string;
  reportData: CbamReportData;
  status: CbamReportStatus;
  createdAt: Date;
  updatedAt: Date;
}
