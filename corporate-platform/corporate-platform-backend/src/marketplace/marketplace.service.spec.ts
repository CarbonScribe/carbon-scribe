import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceService } from './marketplace.service';
import { PrismaService } from '../shared/database/prisma.service';

describe('MarketplaceService', () => {
  let service: MarketplaceService;
  let prisma: PrismaService;

  const mockPrisma = {
    credit: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        { provide: PrismaService, useValue: mockPrisma as any },
      ],
    }).compile();

    service = module.get<MarketplaceService>(MarketplaceService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return similar credits', async () => {
    mockPrisma.credit.findUnique.mockResolvedValue({
      id: 'base',
      country: 'BR',
      methodology: 'VCS',
      vintageYear: 2020,
      sdgs: '7,13',
    });
    mockPrisma.credit.findMany.mockResolvedValue([{ id: 'other' }]);

    const result = await service.getSimilarCredits('base');
    expect(prisma.credit.findUnique).toHaveBeenCalled();
    expect(prisma.credit.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });
});
