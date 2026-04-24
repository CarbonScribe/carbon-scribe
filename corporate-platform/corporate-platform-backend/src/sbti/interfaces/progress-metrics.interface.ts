export interface ProgressMetrics {
  id: string;
  targetId: string;
  reportingYear: number;
  emissions: number;
  targetEmissions: number;
  variance: number;
  onTrack: boolean;
}
