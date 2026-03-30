import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DashboardService } from './services/dashboard.service';
import { PredictiveService } from './services/predictive.service';
import { CreditQualityService } from './services/credit-quality.service';
import { PerformanceService } from './services/performance.service';
import { ProjectComparisonService } from './services/project-comparison.service';
import { RegionalService } from './services/regional.service';
import { TeamPerformanceService } from './services/team-performance.service';
import { TimelineService } from './services/timeline.service';
import { ChartDataDto } from './dto/analytics-query.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(
    private dashboardService: DashboardService,
    private predictiveService: PredictiveService,
    private creditQualityService: CreditQualityService,
    private performanceService: PerformanceService,
    private projectComparisonService: ProjectComparisonService,
    private regionalService: RegionalService,
    private teamPerformanceService: TeamPerformanceService,
    private timelineService: TimelineService,
  ) {}

  // ========================
  // Dashboard Analytics
  // ========================

  @Get('dashboard/overview')
  @HttpCode(HttpStatus.OK)
  async getDashboardOverview(
    @CurrentUser() user: JwtPayload,
    @Query('period') period: string = 'MONTHLY',
  ) {
    return this.dashboardService.getOverview(user.companyId, period);
  }

  @Get('dashboard/insights')
  @HttpCode(HttpStatus.OK)
  async getDashboardInsights(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getInsights(user.companyId);
  }

  // ========================
  // Predictive Analytics
  // ========================

  @Get('predictive/retirements')
  @HttpCode(HttpStatus.OK)
  async predictRetirements(
    @CurrentUser() user: JwtPayload,
    @Query('months') months: string = '12',
  ) {
    const monthsNum = parseInt(months, 10);
    if (monthsNum <= 0 || monthsNum > 120) {
      throw new BadRequestException('Months must be between 1 and 120');
    }
    return this.predictiveService.forecastRetirements(
      user.companyId,
      monthsNum,
    );
  }

  @Get('predictive/impact')
  @HttpCode(HttpStatus.OK)
  async predictImpact(
    @CurrentUser() user: JwtPayload,
    @Query('months') months: string = '12',
  ) {
    const monthsNum = parseInt(months, 10);
    if (monthsNum <= 0 || monthsNum > 120) {
      throw new BadRequestException('Months must be between 1 and 120');
    }
    return this.predictiveService.forecastImpact(user.companyId, monthsNum);
  }

  @Get('predictive/trends')
  @HttpCode(HttpStatus.OK)
  async detectTrends(@CurrentUser() user: JwtPayload) {
    return this.predictiveService.detectTrends(user.companyId);
  }

  // ========================
  // Credit Quality Analytics
  // ========================

  @Get('quality/radar/:projectId')
  @HttpCode(HttpStatus.OK)
  async getQualityRadar(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
  ) {
    return this.creditQualityService.getRadarData(projectId);
  }

  @Get('quality/portfolio')
  @HttpCode(HttpStatus.OK)
  async getPortfolioQuality(@CurrentUser() user: JwtPayload) {
    return this.creditQualityService.getPortfolioQuality(user.companyId);
  }

  @Get('quality/benchmarks')
  @HttpCode(HttpStatus.OK)
  async getQualityBenchmarks(
    @Query('industry') industry?: string,
    @Query('region') region?: string,
  ) {
    return this.creditQualityService.getBenchmarks(industry, region);
  }

  // ========================
  // Performance Analytics
  // ========================

  @Get('performance/over-time')
  @HttpCode(HttpStatus.OK)
  async getPerformanceOverTime(
    @CurrentUser() user: JwtPayload,
    @Query() query: ChartDataDto,
  ) {
    if (!query.startDate || !query.endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }
    return this.performanceService.getPerformanceOverTime(
      user.companyId,
      'retirement_volume',
      query.startDate,
      query.endDate,
      'monthly',
    );
  }

  @Get('performance/by-metric')
  @HttpCode(HttpStatus.OK)
  async getPerformanceByMetric(
    @CurrentUser() user: JwtPayload,
    @Query('metric') metric: string = 'retirement_volume',
    @Query('dimension') dimension: string = 'projectType',
  ) {
    return this.performanceService.getMetricBreakdown(
      user.companyId,
      metric,
      dimension,
    );
  }

  @Get('performance/rankings')
  @HttpCode(HttpStatus.OK)
  async getPerformanceRankings(
    @CurrentUser() user: JwtPayload,
    @Query('metric') metric: string = 'quality',
    @Query('period') period: string = 'MONTHLY',
  ) {
    return this.performanceService.getPerformanceRankings(
      user.companyId,
      metric,
      period,
    );
  }

  // ========================
  // Project Comparison
  // ========================

  @Get('projects/compare')
  @HttpCode(HttpStatus.OK)
  async compareProjects(
    @CurrentUser() user: JwtPayload,
    @Query('projectIds') projectIds: string,
  ) {
    if (!projectIds) {
      throw new BadRequestException('projectIds query parameter is required');
    }
    const ids = projectIds.split(',');
    return this.projectComparisonService.compareProjects(ids);
  }

  @Get('projects/similar/:projectId')
  @HttpCode(HttpStatus.OK)
  async getSimilarProjects(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
    @Query('limit') limit: string = '5',
  ) {
    const limitNum = parseInt(limit, 10);
    if (limitNum <= 0 || limitNum > 50) {
      throw new BadRequestException('Limit must be between 1 and 50');
    }
    return this.projectComparisonService.findSimilarProjects(
      projectId,
      limitNum,
    );
  }

  @Get('projects/outliers')
  @HttpCode(HttpStatus.OK)
  async getOutliers(
    @CurrentUser() user: JwtPayload,
    @Query('metric') metric: string = 'quality',
  ) {
    const validMetrics = ['quality', 'volume', 'availability'];
    if (!validMetrics.includes(metric)) {
      throw new BadRequestException(
        `Metric must be one of: ${validMetrics.join(', ')}`,
      );
    }
    return this.projectComparisonService.findOutliers(user.companyId, metric);
  }

  // ========================
  // Regional Analytics
  // ========================

  @Get('regional/breakdown')
  @HttpCode(HttpStatus.OK)
  async getRegionalBreakdown(@CurrentUser() user: JwtPayload) {
    return this.regionalService.getRegionalBreakdown(user.companyId);
  }

  @Get('regional/heatmap')
  @HttpCode(HttpStatus.OK)
  async getRegionalHeatmap(@CurrentUser() user: JwtPayload) {
    return this.regionalService.getRegionalHeatmap(user.companyId);
  }

  @Get('regional/trends')
  @HttpCode(HttpStatus.OK)
  async getRegionalTrends(
    @CurrentUser() user: JwtPayload,
    @Query('months') months: string = '12',
  ) {
    const monthsNum = parseInt(months, 10);
    if (monthsNum <= 0 || monthsNum > 60) {
      throw new BadRequestException('Months must be between 1 and 60');
    }
    return this.regionalService.getRegionalTrends(user.companyId, monthsNum);
  }

  // ========================
  // Team Analytics
  // ========================

  @Get('team/performance')
  @HttpCode(HttpStatus.OK)
  async getTeamPerformance(@CurrentUser() user: JwtPayload) {
    return this.teamPerformanceService.getTeamPerformance(user.companyId);
  }

  @Get('team/rankings')
  @HttpCode(HttpStatus.OK)
  async getTeamRankings(
    @CurrentUser() user: JwtPayload,
    @Query('metric') metric: string = 'quality',
  ) {
    return this.teamPerformanceService.getTeamRankings(user.companyId, metric);
  }

  @Get('team/portfolio')
  @HttpCode(HttpStatus.OK)
  async getTeamPortfolio(
    @CurrentUser() user: JwtPayload,
    @Query('developerId') developerId?: string,
  ) {
    return this.teamPerformanceService.getTeamPortfolio(
      user.companyId,
      developerId,
    );
  }

  // ========================
  // Carbon Timeline
  // ========================

  @Get('timeline/reduction')
  @HttpCode(HttpStatus.OK)
  async getCarbonTimeline(
    @CurrentUser() user: JwtPayload,
    @Query('months') months: string = '60',
  ) {
    const monthsNum = parseInt(months, 10);
    if (monthsNum <= 0 || monthsNum > 360) {
      throw new BadRequestException('Months must be between 1 and 360');
    }
    return this.timelineService.getCarbonReductionTimeline(
      user.companyId,
      monthsNum,
    );
  }

  @Get('timeline/projections')
  @HttpCode(HttpStatus.OK)
  async getReductionProjections(
    @CurrentUser() user: JwtPayload,
    @Query('months') months: string = '36',
  ) {
    const monthsNum = parseInt(months, 10);
    if (monthsNum <= 0 || monthsNum > 120) {
      throw new BadRequestException('Months must be between 1 and 120');
    }
    return this.timelineService.getReductionProjections(
      user.companyId,
      monthsNum,
    );
  }

  @Get('timeline/milestones')
  @HttpCode(HttpStatus.OK)
  async getMilestones(@CurrentUser() user: JwtPayload) {
    return this.timelineService.getMilestones(user.companyId);
  }
}
