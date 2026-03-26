export interface EsrsDisclosureData {
  value: any;
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
