import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Tenant } from '../multi-tenant/decorators/tenant.decorator';
import { TenantContext } from '../multi-tenant/interfaces/tenant-context.interface';
import { TeamCollaborationService } from './team-collaboration.service';
import { ActivityQueryDto } from './dto/activity-query.dto';
import {
  DateRangeDto,
  PaginatedQueryDto,
  MemberIdDto,
} from './dto/date-range.dto';

@Controller('api/v1/team')
@UseGuards(JwtAuthGuard)
export class TeamCollaborationController {
  constructor(
    private readonly teamCollaborationService: TeamCollaborationService,
  ) {}

  // ==================== Activity Feed Endpoints ====================

  @Get('activity')
  async getActivityFeed(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
    @Query() query: ActivityQueryDto,
  ) {
    return this.teamCollaborationService.getActivityFeed(tenant.companyId, {
      ...query,
      companyId: tenant.companyId,
    });
  }

  @Get('activity/recent')
  async getRecentActivities(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
    @Query('limit') limit = 10,
  ) {
    return this.teamCollaborationService.getRecentActivities(
      tenant.companyId,
      Number(limit),
    );
  }

  @Get('activity/user/:userId')
  async getUserActivity(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
    @Param('userId') userId: string,
    @Query('limit') limit = 50,
  ) {
    return this.teamCollaborationService.getUserActivity(
      tenant.companyId,
      userId,
      Number(limit),
    );
  }

  @Get('activity/summary')
  async getActivitySummary(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
    @Query() dateRange: DateRangeDto,
  ) {
    return this.teamCollaborationService.getActivitySummary(
      tenant.companyId,
      dateRange,
    );
  }

  // ==================== Performance Metrics Endpoints ====================

  @Get('performance')
  async getTeamPerformance(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
    @Query() dateRange: DateRangeDto,
  ) {
    const periodStart =
      dateRange.periodStart ||
      dateRange.startDate ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const periodEnd = dateRange.periodEnd || dateRange.endDate || new Date();

    return this.teamCollaborationService.getTeamPerformance(tenant.companyId, {
      companyId: tenant.companyId,
      periodStart,
      periodEnd,
      includeMembers: true,
      includeTrends: true,
      includeBenchmarks: true,
    });
  }

  @Get('performance/members')
  async getMemberPerformance(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
    @Query() dateRange: DateRangeDto,
  ) {
    const periodStart =
      dateRange.periodStart ||
      dateRange.startDate ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const periodEnd = dateRange.periodEnd || dateRange.endDate || new Date();

    return this.teamCollaborationService.getTeamPerformance(tenant.companyId, {
      companyId: tenant.companyId,
      periodStart,
      periodEnd,
      includeMembers: true,
      includeTrends: false,
      includeBenchmarks: false,
    });
  }

  @Get('performance/trends')
  async getPerformanceTrends(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
    @Query() dateRange: DateRangeDto,
  ) {
    const periodStart =
      dateRange.periodStart ||
      dateRange.startDate ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const periodEnd = dateRange.periodEnd || dateRange.endDate || new Date();

    return this.teamCollaborationService.getTeamPerformance(tenant.companyId, {
      companyId: tenant.companyId,
      periodStart,
      periodEnd,
      includeMembers: false,
      includeTrends: true,
      includeBenchmarks: false,
    });
  }

  @Get('performance/benchmarks')
  async getPerformanceBenchmarks(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
    @Query() dateRange: DateRangeDto,
  ) {
    const periodStart =
      dateRange.periodStart ||
      dateRange.startDate ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const periodEnd = dateRange.periodEnd || dateRange.endDate || new Date();

    return this.teamCollaborationService.getTeamPerformance(tenant.companyId, {
      companyId: tenant.companyId,
      periodStart,
      periodEnd,
      includeMembers: true,
      includeTrends: false,
      includeBenchmarks: true,
    });
  }

  // ==================== Collaboration Score Endpoints ====================

  @Get('collaboration/score')
  async getCollaborationScore(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
    @Query() dateRange: DateRangeDto,
  ) {
    const periodStart =
      dateRange.periodStart ||
      dateRange.startDate ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const periodEnd = dateRange.periodEnd || dateRange.endDate || new Date();

    return this.teamCollaborationService.getCollaborationScore(
      tenant.companyId,
      {
        companyId: tenant.companyId,
        periodStart,
        periodEnd,
        metricType: 'WEEKLY_SCORE',
        includeHistory: true,
        includeRecommendations: true,
      },
    );
  }

  @Get('collaboration/score/history')
  async getCollaborationScoreHistory(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
    @Query('metricType')
    metricType: 'WEEKLY_SCORE' | 'MONTHLY_SCORE' = 'WEEKLY_SCORE',
  ) {
    return this.teamCollaborationService.getCollaborationScore(
      tenant.companyId,
      {
        companyId: tenant.companyId,
        metricType,
        includeHistory: true,
        includeRecommendations: false,
      },
    );
  }

  @Get('collaboration/components')
  async getCollaborationComponents(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
    @Query() dateRange: DateRangeDto,
  ) {
    const periodStart =
      dateRange.periodStart ||
      dateRange.startDate ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const periodEnd = dateRange.periodEnd || dateRange.endDate || new Date();

    const score = await this.teamCollaborationService.getCollaborationScore(
      tenant.companyId,
      {
        companyId: tenant.companyId,
        periodStart,
        periodEnd,
        includeHistory: false,
        includeRecommendations: false,
      },
    );

    return {
      companyId: tenant.companyId,
      periodStart,
      periodEnd,
      overallScore: score.overallScore,
      components: score.components,
      rating: score.rating,
    };
  }

  @Get('collaboration/recommendations')
  async getCollaborationRecommendations(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
    @Query() dateRange: DateRangeDto,
  ) {
    const periodStart =
      dateRange.periodStart ||
      dateRange.startDate ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const periodEnd = dateRange.periodEnd || dateRange.endDate || new Date();

    const score = await this.teamCollaborationService.getCollaborationScore(
      tenant.companyId,
      {
        companyId: tenant.companyId,
        periodStart,
        periodEnd,
        includeHistory: false,
        includeRecommendations: true,
      },
    );

    return {
      companyId: tenant.companyId,
      recommendations: score.recommendations,
    };
  }

  @Get('collaboration/top-contributors')
  async getTopContributors(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
    @Query('limit') limit = 10,
  ) {
    return this.teamCollaborationService.getTopContributors(
      tenant.companyId,
      Number(limit),
    );
  }

  // ==================== Member Details Endpoints ====================

  @Get('members/:id/details')
  async getMemberDetails(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
    @Param() params: MemberIdDto,
  ) {
    return this.teamCollaborationService.getMemberProfile(
      tenant.companyId,
      params.id,
    );
  }

  @Get('members/:id/activity-history')
  async getMemberActivityHistory(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
    @Param() params: MemberIdDto,
    @Query() pagination: PaginatedQueryDto,
  ) {
    return this.teamCollaborationService.getMemberActivityHistory(
      tenant.companyId,
      params.id,
      pagination.page || 1,
      pagination.limit || 50,
    );
  }

  @Get('members/:id/contributions')
  async getMemberContributions(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
    @Param() params: MemberIdDto,
    @Query() dateRange: DateRangeDto,
  ) {
    const startDate =
      dateRange.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange.endDate || new Date();

    return this.teamCollaborationService.getMemberContributions(
      tenant.companyId,
      params.id,
      { startDate, endDate },
    );
  }

  @Get('members/:id/collaboration')
  async getMemberCollaborationPatterns(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
    @Param() params: MemberIdDto,
  ) {
    return this.teamCollaborationService.getMemberCollaborationPatterns(
      tenant.companyId,
      params.id,
    );
  }

  // ==================== Notifications Endpoints ====================

  @Get('notifications/unread')
  async getUnreadNotifications(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
  ) {
    return this.teamCollaborationService.getUnreadNotifications(
      tenant.companyId,
      user.sub,
    );
  }

  @Post('notifications/:id/read')
  async markNotificationAsRead(
    @CurrentUser() user: JwtPayload,
    @Tenant() tenant: TenantContext,
    @Param('id') notificationId: string,
  ) {
    return this.teamCollaborationService.markNotificationAsRead(
      notificationId,
      tenant.companyId,
      user.sub,
    );
  }
}
