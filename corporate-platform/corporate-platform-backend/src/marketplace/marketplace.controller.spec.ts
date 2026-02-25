import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceController } from './marketplace.controller';
import { SearchService } from './services/search.service';
import { RecommendationService } from './services/recommendation.service';
import { DiscoveryService } from './services/discovery.service';
import { StatsService } from './services/stats.service';
import { MarketplaceService } from './marketplace.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('MarketplaceController', () => {
  let controller: MarketplaceController;

  const mockSearchService = {
    search: jest.fn(),
  };

  const mockRecommendationService = {
    getRecommendations: jest.fn(),
  };

  const mockDiscoveryService = {
    getFeatured: jest.fn(),
    getTrending: jest.fn(),
    getNewest: jest.fn(),
    getDiscoveryOverview: jest.fn(),
  };

  const mockStatsService = {
    getStats: jest.fn(),
    getFilters: jest.fn(),
  };

  const mockMarketplaceService = {
    getSimilarCredits: jest.fn(),
  };

  const mockUser: JwtPayload = {
    sub: 'user-id',
    email: 'user@example.com',
    companyId: 'company-id',
    role: 'viewer',
    sessionId: 'session-id',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketplaceController],
      providers: [
        { provide: SearchService, useValue: mockSearchService },
        { provide: RecommendationService, useValue: mockRecommendationService },
        { provide: DiscoveryService, useValue: mockDiscoveryService },
        { provide: StatsService, useValue: mockStatsService },
        { provide: MarketplaceService, useValue: mockMarketplaceService },
      ],
    }).compile();

    controller = module.get<MarketplaceController>(MarketplaceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate search to SearchService', async () => {
    const query: any = { query: 'forest', page: 1, limit: 10 };
    await controller.search(query);
    expect(mockSearchService.search).toHaveBeenCalledWith(query);
  });

  it('should delegate recommendations to RecommendationService', async () => {
    await controller.recommendations(mockUser, '7,13');
    expect(mockRecommendationService.getRecommendations).toHaveBeenCalled();
  });

  it('should delegate featured to DiscoveryService', async () => {
    await controller.featured();
    expect(mockDiscoveryService.getFeatured).toHaveBeenCalled();
  });

  it('should delegate stats to StatsService', async () => {
    await controller.stats();
    expect(mockStatsService.getStats).toHaveBeenCalled();
  });

  it('should delegate filters to StatsService', async () => {
    await controller.filters();
    expect(mockStatsService.getFilters).toHaveBeenCalled();
  });

  it('should delegate similar credits to MarketplaceService', async () => {
    await controller.similar('credit-1');
    expect(mockMarketplaceService.getSimilarCredits).toHaveBeenCalledWith(
      'credit-1',
    );
  });
});
