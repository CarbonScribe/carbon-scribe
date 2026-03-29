import { Injectable } from '@nestjs/common';
import { ActivityFeedService } from './services/activity-feed.service';
import { CollaborationScoreService } from './services/collaboration-score.service';
import { MemberDetailsService } from './services/member-details.service';
import { PerformanceMetricsService } from './services/performance-metrics.service';

@Injectable()
export class TeamCollaborationService {
  constructor(
    private readonly activityFeed: ActivityFeedService,
    private readonly performance: PerformanceMetricsService,
    private readonly collaboration: CollaborationScoreService,
    private readonly members: MemberDetailsService,
  ) {}

  recordActivity(input: {
    companyId: string;
    userId: string;
    activityType: string;
    metadata?: Record<string, unknown>;
    entityType?: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
    timestamp?: Date;
  }) {
    return this.activityFeed.recordActivity(input);
  }

  getActivityFeed(companyId: string, query: any) {
    return this.activityFeed.getActivityFeed(companyId, query);
  }

  getRecentActivities(companyId: string, limit?: number) {
    return this.activityFeed.getRecentActivities(companyId, limit);
  }

  getActivitySummary(companyId: string, range?: { from?: Date; to?: Date }) {
    return this.activityFeed.getActivitySummary(companyId, range);
  }

  getPerformanceDashboard(companyId: string, range?: { from?: Date; to?: Date }) {
    return this.performance.getTeamDashboard(companyId, range);
  }

  getMemberPerformance(companyId: string, range?: { from?: Date; to?: Date }) {
    return this.performance.getMemberPerformance(companyId, range);
  }

  getPerformanceTrends(companyId: string, range?: { from?: Date; to?: Date }) {
    return this.performance.getTrends(companyId, range);
  }

  getBenchmarks(companyId: string, range?: { from?: Date; to?: Date }) {
    return this.performance.getBenchmarks(companyId, range);
  }

  getCollaborationScore(companyId: string) {
    return this.collaboration.getCurrentTeamScore(companyId);
  }

  getCollaborationHistory(companyId: string, metricType?: 'WEEKLY_SCORE' | 'MONTHLY_SCORE') {
    return this.collaboration.getScoreHistory(companyId, metricType);
  }

  getCollaborationComponents(companyId: string) {
    return this.collaboration.getComponents(companyId);
  }

  getCollaborationRecommendations(companyId: string) {
    return this.collaboration.getRecommendations(companyId);
  }

  getMemberDetails(companyId: string, memberId: string) {
    return this.members.getMemberDetails(companyId, memberId);
  }

  getMemberActivityHistory(companyId: string, actorCompanyId: string, memberId: string, query: any) {
    return this.members.getActivityHistory(companyId, actorCompanyId, memberId, query);
  }

  getMemberContributions(companyId: string, memberId: string, range?: { from?: Date; to?: Date }) {
    return this.members.getContributions(companyId, memberId, range);
  }

  getMemberCollaboration(companyId: string, memberId: string, range?: { from?: Date; to?: Date }) {
    return this.members.getCollaborationPatterns(companyId, memberId, range);
  }
}

