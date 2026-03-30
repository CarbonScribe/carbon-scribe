import { Injectable, Logger } from '@nestjs/common';
import { ActivityFeedService } from './services/activity-feed.service';
import { PerformanceMetricsService } from './services/performance-metrics.service';
import { CollaborationScoreService } from './services/collaboration-score.service';
import { MemberDetailsService } from './services/member-details.service';
import { NotificationsService } from './services/notifications.service';
import { ActivityFeedQuery } from './interfaces/team-activity.interface';
import { PerformanceQuery } from './interfaces/team-performance.interface';
import { CollaborationScoreQuery } from './interfaces/collaboration-score.interface';
import { DateRangeDto } from './dto/date-range.dto';

@Injectable()
export class TeamCollaborationService {
  private readonly logger = new Logger(TeamCollaborationService.name);

  constructor(
    private readonly activityFeedService: ActivityFeedService,
    private readonly performanceMetricsService: PerformanceMetricsService,
    private readonly collaborationScoreService: CollaborationScoreService,
    private readonly memberDetailsService: MemberDetailsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Activity Feed Methods
  async getActivityFeed(companyId: string, query: ActivityFeedQuery) {
    return this.activityFeedService.getActivityFeed({ ...query, companyId });
  }

  async getRecentActivities(companyId: string, limit = 10) {
    return this.activityFeedService.getRecentActivities(companyId, limit);
  }

  async getUserActivity(companyId: string, userId: string, limit = 50) {
    return this.activityFeedService.getUserActivity(companyId, userId, limit);
  }

  async getActivitySummary(companyId: string, dateRange: DateRangeDto) {
    const startDate =
      dateRange.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = dateRange.endDate || new Date();
    return this.activityFeedService.getActivitySummary(
      companyId,
      startDate,
      endDate,
    );
  }

  async logActivity(data: {
    companyId: string;
    userId: string;
    activityType: any;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.activityFeedService.logActivity(data);
  }

  // Performance Metrics Methods
  async getTeamPerformance(companyId: string, query: PerformanceQuery) {
    return this.performanceMetricsService.getTeamPerformance(query);
  }

  async getMemberPerformance(
    companyId: string,
    userId: string,
    dateRange: DateRangeDto,
  ) {
    const startDate =
      dateRange.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = dateRange.endDate || new Date();
    return this.performanceMetricsService.getMemberPerformance(
      companyId,
      userId,
      startDate,
      endDate,
    );
  }

  // Collaboration Score Methods
  async getCollaborationScore(
    companyId: string,
    query: CollaborationScoreQuery,
  ) {
    return this.collaborationScoreService.getCollaborationScore({
      ...query,
      companyId,
    });
  }

  async getTopContributors(companyId: string, limit = 10) {
    return this.collaborationScoreService.getTopContributors(companyId, limit);
  }

  // Member Details Methods
  async getMemberProfile(companyId: string, memberId: string) {
    return this.memberDetailsService.getMemberProfile(companyId, memberId);
  }

  async getMemberActivityHistory(
    companyId: string,
    userId: string,
    page = 1,
    limit = 50,
  ) {
    return this.memberDetailsService.getActivityHistory(
      companyId,
      userId,
      limit,
      page,
    );
  }

  async getMemberContributions(
    companyId: string,
    userId: string,
    dateRange: DateRangeDto,
  ) {
    const startDate =
      dateRange.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange.endDate || new Date();
    return this.memberDetailsService.getContributions(
      companyId,
      userId,
      startDate,
      endDate,
    );
  }

  async getMemberCollaborationPatterns(companyId: string, userId: string) {
    return this.memberDetailsService.getCollaborationPatterns(
      companyId,
      userId,
    );
  }

  // Notifications Methods
  async getUnreadNotifications(companyId: string, userId?: string) {
    return this.notificationsService.getUnreadNotifications(companyId, userId);
  }

  async markNotificationAsRead(
    notificationId: string,
    companyId: string,
    userId: string,
  ) {
    return this.notificationsService.markAsRead(
      notificationId,
      companyId,
      userId,
    );
  }

  async notifyTeamMemberJoined(companyId: string, email: string, name: string) {
    return this.notificationsService.notifyTeamMemberJoined(
      companyId,
      email,
      name,
    );
  }

  async notifyRoleChange(
    companyId: string,
    userId: string,
    oldRole: string,
    newRole: string,
  ) {
    return this.notificationsService.notifyRoleChange(
      companyId,
      userId,
      oldRole,
      newRole,
    );
  }

  async notifyTargetAchieved(
    companyId: string,
    target: number,
    actual: number,
  ) {
    return this.notificationsService.notifyTargetAchieved(
      companyId,
      target,
      actual,
    );
  }

  async notifyCollaborationMilestone(
    companyId: string,
    score: number,
    rating: string,
  ) {
    return this.notificationsService.notifyCollaborationMilestone(
      companyId,
      score,
      rating,
    );
  }
}
