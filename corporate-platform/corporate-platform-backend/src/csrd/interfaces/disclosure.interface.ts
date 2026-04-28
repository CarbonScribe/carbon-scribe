export enum EsrsStandard {
  E1 = 'ESRS E1',
  E2 = 'ESRS E2',
  E3 = 'ESRS E3',
  E4 = 'ESRS E4',
  E5 = 'ESRS E5',
  S1 = 'ESRS S1',
  S2 = 'ESRS S2',
  S3 = 'ESRS S3',
  S4 = 'ESRS S4',
  G1 = 'ESRS G1',
}

export interface EsrsDisclosureData {
  value: unknown;
  unit?: string;
  context?: string;
  sourceFiles?: string[];
  lastUpdated: Date;
}

export interface DisclosureRequirement {
  id: string;
  standard: string;
  requirement: string;
  description: string;
  dataPoints: string[];
}
