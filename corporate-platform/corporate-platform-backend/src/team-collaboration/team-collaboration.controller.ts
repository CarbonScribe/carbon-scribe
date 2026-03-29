import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { DateRangeDto } from './dto/date-range.dto';
import { TeamCollaborationService } from './team-collaboration.service';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/team')
export class TeamCollaborationController {
  constructor(private readonly team: TeamCollaborationService) {}

  @Get('activity')
  async getActivityFeed(@CurrentUser() user: JwtPayload, @Query() query: ActivityQueryDto) {
    const data = await this.team.getActivityFeed(user.companyId, query);
    return { success: true, data, timestamp: new Date() };
  }

  @Get('activity/recent')
  async getRecentActivity(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : undefined;
    const data = await this.team.getRecentActivities(user.companyId, parsed);
    return { success: true, data, timestamp: new Date() };
  }

  @Get('activity/user/:userId')
  async getUserActivity(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Query() query: ActivityQueryDto,
  ) {
    const data = await this.team.getActivityFeed(user.companyId, { ...query, userId });
    return { success: true, data, timestamp: new Date() };
  }

  @Get('activity/summary')
  async getActivitySummary(@CurrentUser() user: JwtPayload, @Query() query: DateRangeDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const data = await this.team.getActivitySummary(user.companyId, { from, to });
    return { success: true, data, timestamp: new Date() };
  }

  @Get('performance')
  async getTeamPerformance(@CurrentUser() user: JwtPayload, @Query() query: DateRangeDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const data = await this.team.getPerformanceDashboard(user.companyId, { from, to });
    return { success: true, data, timestamp: new Date() };
  }

  @Get('performance/members')
  async getMemberPerformance(@CurrentUser() user: JwtPayload, @Query() query: DateRangeDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const data = await this.team.getMemberPerformance(user.companyId, { from, to });
    return { success: true, data, timestamp: new Date() };
  }

  @Get('performance/trends')
  async getPerformanceTrends(@CurrentUser() user: JwtPayload, @Query() query: DateRangeDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const data = await this.team.getPerformanceTrends(user.companyId, { from, to });
    return { success: true, data, timestamp: new Date() };
  }

  @Get('performance/benchmarks')
  async getBenchmarks(@CurrentUser() user: JwtPayload, @Query() query: DateRangeDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const data = await this.team.getBenchmarks(user.companyId, { from, to });
    return { success: true, data, timestamp: new Date() };
  }

  @Get('collaboration/score')
  async getCollaborationScore(@CurrentUser() user: JwtPayload) {
    const data = await this.team.getCollaborationScore(user.companyId);
    return { success: true, data, timestamp: new Date() };
  }

  @Get('collaboration/score/history')
  async getCollaborationScoreHistory(
    @CurrentUser() user: JwtPayload,
    @Query('metricType') metricType?: 'WEEKLY_SCORE' | 'MONTHLY_SCORE',
  ) {
    const data = await this.team.getCollaborationHistory(user.companyId, metricType);
    return { success: true, data, timestamp: new Date() };
  }

  @Get('collaboration/components')
  async getCollaborationComponents(@CurrentUser() user: JwtPayload) {
    const data = await this.team.getCollaborationComponents(user.companyId);
    return { success: true, data, timestamp: new Date() };
  }

  @Get('collaboration/recommendations')
  async getCollaborationRecommendations(@CurrentUser() user: JwtPayload) {
    const data = await this.team.getCollaborationRecommendations(user.companyId);
    return { success: true, data, timestamp: new Date() };
  }

  @Get('members/:id/details')
  async getMemberDetails(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const data = await this.team.getMemberDetails(user.companyId, id);
    return { success: true, data, timestamp: new Date() };
  }

  @Get('members/:id/activity-history')
  async getMemberActivityHistory(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query() query: ActivityQueryDto,
  ) {
    const data = await this.team.getMemberActivityHistory(user.companyId, user.companyId, id, query);
    return { success: true, data, timestamp: new Date() };
  }

  @Get('members/:id/contributions')
  async getMemberContributions(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Query() query: DateRangeDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const data = await this.team.getMemberContributions(user.companyId, id, { from, to });
    return { success: true, data, timestamp: new Date() };
  }

  @Get('members/:id/collaboration')
  async getMemberCollaboration(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Query() query: DateRangeDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const data = await this.team.getMemberCollaboration(user.companyId, id, { from, to });
    return { success: true, data, timestamp: new Date() };
  }
}

