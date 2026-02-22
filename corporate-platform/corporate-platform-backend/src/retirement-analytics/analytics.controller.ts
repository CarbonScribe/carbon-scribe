import { Controller, Get, Query } from '@nestjs/common';
import { RetirementAnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('api/v1/retirement-analytics')
export class RetirementAnalyticsController {
  constructor(private readonly analyticsService: RetirementAnalyticsService) {}

  @Get('purpose-breakdown')
  async getPurposeBreakdown(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getPurposeBreakdown(query);
  }

  @Get('trends')
  async getTrends(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getTrends(query);
  }

  @Get('forecast')
  async getForecast(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getForecast(query);
  }

  @Get('impact')
  async getImpactMetrics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getImpactMetrics(query);
  }

  @Get('progress')
  async getProgress(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getProgress(query);
  }

  @Get('summary')
  async getSummary(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getSummary(query);
  }
}
