export interface CollaborationScoreBreakdown {
  overallScore: number;
  components: Record<string, number>;
  topContributors: {
    userId: string;
    score: number;
    actionsCount: number;
    uniqueDays: number;
  }[];
  insights: string[];
  explanation: {
    weights: Record<string, number>;
    inputs: Record<string, unknown>;
  };
}

