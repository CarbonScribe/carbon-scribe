import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './services/search.service';
import { RecommendationService } from './services/recommendation.service';
import { DiscoveryService } from './services/discovery.service';
import { StatsService } from './services/stats.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { MarketplaceService } from './marketplace.service';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/marketplace')
export class MarketplaceController {
  constructor(
    private readonly searchService: SearchService,
    private readonly recommendationService: RecommendationService,
    private readonly discoveryService: DiscoveryService,
    private readonly statsService: StatsService,
    private readonly marketplaceService: MarketplaceService,
  ) {}

  @Get('search')
  async search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }

  @Get('recommendations')
  async recommendations(
    @CurrentUser() user: JwtPayload,
    @Query('sdgs') sdgsParam?: string,
  ) {
    const sdgs =
      sdgsParam && sdgsParam.length > 0
        ? sdgsParam
            .split(',')
            .map((p) => Number(p.trim()))
            .filter((n) => !Number.isNaN(n))
        : undefined;

    return this.recommendationService.getRecommendations(
      {
        userId: user.sub,
        companyId: user.companyId,
      },
      { sdgs },
    );
  }

  @Get('featured')
  async featured() {
    return this.discoveryService.getFeatured();
  }

  @Get('trending')
  async trending() {
    return this.discoveryService.getTrending();
  }

  @Get('new')
  async newest() {
    return this.discoveryService.getNewest();
  }

  @Get('stats')
  async stats() {
    return this.statsService.getStats();
  }

  @Get('filters')
  async filters() {
    return this.statsService.getFilters();
  }

  @Get('similar/:creditId')
  async similar(@Param('creditId') creditId: string) {
    return this.marketplaceService.getSimilarCredits(creditId);
  }

  @Get('discovery')
  async discoveryOverview() {
    return this.discoveryService.getDiscoveryOverview();
  }
}
