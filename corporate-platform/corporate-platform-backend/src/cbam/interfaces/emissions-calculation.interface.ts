export interface EmissionsCalculationInput {
  companyId: string;
  goodsId: string;
  quantity: number;
  quantityUnit: string;
  countryOfOrigin: string;
  actualEmissions?: number;
  installationId?: string;
}

export interface EmissionsCalculationResult {
  actualEmissions: number | null;
  defaultEmissions: number;
  totalEmissions: number;
  calculationMethod: 'ACTUAL' | 'DEFAULT';
  unit: string;
  calculationDate: string;
}

export interface CbamEmissionsFactor {
  sector: string;
  emissionFactor: number;
  unit: string;
  source: string;
  validFrom: Date;
  validUntil?: Date;
}
