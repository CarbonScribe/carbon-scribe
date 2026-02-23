export interface ProgressGoal {
  target: number;
  achieved: number;
  percentage: number;
  projectedCompletionDate?: string;
}

export interface ProgressResponse {
  annual: ProgressGoal;
  netZero: ProgressGoal;
  onTrack: boolean;
  behindScheduleAlert: boolean;
  alertMessage?: string;
}
