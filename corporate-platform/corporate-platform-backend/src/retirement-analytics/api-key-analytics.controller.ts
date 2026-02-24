import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RetirementAnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { ApiKeyGuard } from '../api-key/guards/api-key.guard';
import { ApiKeyPermissions } from '../api-key/decorators/api-key-permissions.decorator';
import { CurrentApiKey } from '../api-key/decorators/current-api-key.decorator';
import { ApiKeyAuthContext } from '../api-key/interfaces/api-key.interface';

@Controller('api/v1/integrations/retirement-analytics')
@UseGuards(ApiKeyGuard)
@ApiKeyPermissions('analytics:read')
export class ApiKeyRetirementAnalyticsController {
  constructor(private readonly analyticsService: RetirementAnalyticsService) {}

  @Get('purpose-breakdown')
  async getPurposeBreakdown(
    @Query() query: AnalyticsQueryDto,
    @CurrentApiKey() apiKey: ApiKeyAuthContext,
  ) {
    return this.analyticsService.getPurposeBreakdown(
      this.withCompanyScope(query, apiKey),
    );
  }

  @Get('trends')
  async getTrends(
    @Query() query: AnalyticsQueryDto,
    @CurrentApiKey() apiKey: ApiKeyAuthContext,
  ) {
    return this.analyticsService.getTrends(
      this.withCompanyScope(query, apiKey),
    );
  }

  @Get('forecast')
  async getForecast(
    @Query() query: AnalyticsQueryDto,
    @CurrentApiKey() apiKey: ApiKeyAuthContext,
  ) {
    return this.analyticsService.getForecast(
      this.withCompanyScope(query, apiKey),
    );
  }

  @Get('impact')
  async getImpactMetrics(
    @Query() query: AnalyticsQueryDto,
    @CurrentApiKey() apiKey: ApiKeyAuthContext,
  ) {
    return this.analyticsService.getImpactMetrics(
      this.withCompanyScope(query, apiKey),
    );
  }

  @Get('progress')
  async getProgress(
    @Query() query: AnalyticsQueryDto,
    @CurrentApiKey() apiKey: ApiKeyAuthContext,
  ) {
    return this.analyticsService.getProgress(
      this.withCompanyScope(query, apiKey),
    );
  }

  @Get('summary')
  async getSummary(
    @Query() query: AnalyticsQueryDto,
    @CurrentApiKey() apiKey: ApiKeyAuthContext,
  ) {
    return this.analyticsService.getSummary(
      this.withCompanyScope(query, apiKey),
    );
  }

  private withCompanyScope(
    query: AnalyticsQueryDto,
    apiKey: ApiKeyAuthContext,
  ): AnalyticsQueryDto {
    return {
      ...query,
      companyId: apiKey.companyId,
    };
  }
}
