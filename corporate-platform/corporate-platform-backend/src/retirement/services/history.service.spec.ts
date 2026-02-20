import { Test, TestingModule } from '@nestjs/testing';
import { HistoryService } from './history.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('HistoryService', () => {
  let service: HistoryService;

  const mockPrisma = {
    retirement: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<HistoryService>(HistoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return paginated history', async () => {
    const mockRetirements = [{ id: '1', amount: 10, purpose: 'scope1' }];
    mockPrisma.retirement.findMany.mockResolvedValue(mockRetirements);
    mockPrisma.retirement.count.mockResolvedValue(1);

    const result = await service.getHistory({ page: 1, limit: 10 });
    expect(result.data).toEqual(mockRetirements);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it('should calculate stats correctly', async () => {
    const mockRetirements = [
      { amount: 10, purpose: 'scope1', retiredAt: new Date() },
      { amount: 20, purpose: 'scope2', retiredAt: new Date() },
    ];
    mockPrisma.retirement.findMany.mockResolvedValue(mockRetirements);

    const result = await service.getStats('comp1');
    expect(result.totalRetired).toBe(30);
    expect(result.byPurpose.scope1).toBe(10);
    expect(result.byPurpose.scope2).toBe(20);
  });
});
