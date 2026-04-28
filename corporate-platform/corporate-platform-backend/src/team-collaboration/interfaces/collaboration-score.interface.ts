export interface CollaborationScore {
  companyId: string;
  periodStart: Date;
  periodEnd: Date;
  overallScore: number; // 0-100
  components: ScoreComponents;
  rating: CollaborationRating;
  insights: string[];
  recommendations: Recommendation[];
  history: ScoreHistory[];
}

export interface ScoreComponents {
  communicationScore: number; // 0-100
  knowledgeSharingScore: number; // 0-100
  responseTimeScore: number; // 0-100
  meetingParticipationScore: number; // 0-100
  crossTeamCollaborationScore: number; // 0-100
  goalAlignmentScore: number; // 0-100
}

export type CollaborationRating =
  | 'EXCELLENT' // 90-100
  | 'VERY_GOOD' // 75-89
  | 'GOOD' // 60-74
  | 'FAIR' // 40-59
  | 'NEEDS_IMPROVEMENT'; // 0-39

export interface Recommendation {
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  expectedImpact: string;
  implementationEffort: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ScoreHistory {
  periodStart: Date;
  periodEnd: Date;
  overallScore: number;
  metricType: 'WEEKLY_SCORE' | 'MONTHLY_SCORE';
}

export interface TopContributor {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  collaborationScore: number;
  contributions: ContributionBreakdown;
}

export interface ContributionBreakdown {
  communications: number;
  knowledgeSharing: number;
  helpProvided: number;
  meetingsAttended: number;
  goalsCompleted: number;
}

export interface CollaborationScoreQuery {
  companyId?: string; // Optional - added by service layer
  periodStart?: Date;
  periodEnd?: Date;
  metricType?: 'WEEKLY_SCORE' | 'MONTHLY_SCORE';
  includeHistory?: boolean;
  includeRecommendations?: boolean;
}
