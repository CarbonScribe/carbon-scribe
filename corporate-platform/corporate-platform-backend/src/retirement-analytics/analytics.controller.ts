import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RetirementAnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('api/v1/retirement-analytics')
@UseGuards(JwtAuthGuard)
export class RetirementAnalyticsController {
  constructor(private readonly analyticsService: RetirementAnalyticsService) {}

  private withCompanyScope(
    query: AnalyticsQueryDto,
    user: JwtPayload,
  ): AnalyticsQueryDto {
    return {
      ...query,
      companyId: user.companyId,
    };
  }

  @Get('purpose-breakdown')
  async getPurposeBreakdown(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.analyticsService.getPurposeBreakdown(
      this.withCompanyScope(query, user),
    );
  }

  @Get('trends')
  async getTrends(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.analyticsService.getTrends(this.withCompanyScope(query, user));
  }

  @Get('forecast')
  async getForecast(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.analyticsService.getForecast(
      this.withCompanyScope(query, user),
    );
  }

  @Get('impact')
  async getImpactMetrics(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.analyticsService.getImpactMetrics(
      this.withCompanyScope(query, user),
    );
  }

  @Get('progress')
  async getProgress(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.analyticsService.getProgress(
      this.withCompanyScope(query, user),
    );
  }

  @Get('summary')
  async getSummary(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.analyticsService.getSummary(this.withCompanyScope(query, user));
  }
}
