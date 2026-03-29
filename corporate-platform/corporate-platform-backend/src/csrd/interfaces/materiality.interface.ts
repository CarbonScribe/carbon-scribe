export interface MaterialityTopic {
  id: string;
  name: string;
  category: 'environmental' | 'social' | 'governance';
  impactScore: number; // 1-5
  financialScore: number; // 1-5
  isMaterial: boolean;
  justification: string;
}

export interface MaterialityAssessmentResult {
  topics: MaterialityTopic[];
  overallSummary: string;
  thresholds: {
    impact: number;
    financial: number;
  };
}
