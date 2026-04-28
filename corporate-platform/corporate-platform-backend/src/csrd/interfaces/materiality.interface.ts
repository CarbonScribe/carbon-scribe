export interface MaterialityTopic {
  id: string;
  name: string;
  category: 'environmental' | 'social' | 'governance';
  impactScore: number; // 1-5
  financialScore: number; // 1-5
  isMaterial?: boolean;
  justification: string;
  relatedStandard?: string;
}

export interface MaterialityThresholds {
  impact: number;
  financial: number;
}

export interface MaterialityAssessmentResult {
  topics: MaterialityTopic[];
  materialTopics: MaterialityTopic[];
  overallSummary: string;
  thresholds: MaterialityThresholds;
  coverageByCategory: {
    environmental: number;
    social: number;
    governance: number;
  };
}
