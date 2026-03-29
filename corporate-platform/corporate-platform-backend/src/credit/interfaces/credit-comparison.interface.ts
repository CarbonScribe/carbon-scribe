export interface ComparisonPoint {
  projectId: string;
  projectName: string;
  pricePerTon: number;
  dynamicScore: number;
  country?: string | null;
  methodology?: string | null;
  vintage?: number | null;
}

export interface ComparisonResult {
  points: ComparisonPoint[];
  avgPrice: number;
  avgScore: number;
}
