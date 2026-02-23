import { Test, TestingModule } from '@nestjs/testing';
import { QualityService } from './quality.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('QualityService', () => {
  let service: QualityService;
  let prisma: PrismaService;

  const mockPrismaService = {
    credit: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QualityService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<QualityService>(QualityService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateDynamicScore', () => {
    it('should calculate score correctly based on weights', () => {
      const metrics = {
        verificationScore: 100, // 25
        additionalityScore: 100, // 20
        permanenceScore: 100, // 15
        leakageScore: 100, // 10
        cobenefitsScore: 100, // 20
        transparencyScore: 100, // 10
      };

      const result = service.calculateDynamicScore(metrics);
      expect(result).toBe(100);
    });

    it('should calculate partial scores correctly', () => {
      const metrics = {
        verificationScore: 80, // 20
        additionalityScore: 70, // 14
        permanenceScore: 60, // 9
        leakageScore: 50, // 5
        cobenefitsScore: 90, // 18
        transparencyScore: 40, // 4
      };
      // Total: 20 + 14 + 9 + 5 + 18 + 4 = 70

      const result = service.calculateDynamicScore(metrics);
      expect(result).toBe(70);
    });
  });

  describe('updateDynamicScore', () => {
    it('should fetch metrics and update credit score', async () => {
      const id = 'credit-1';
      const mockMetrics = {
        verificationScore: 100,
        additionalityScore: 100,
        permanenceScore: 100,
        leakageScore: 100,
        cobenefitsScore: 100,
        transparencyScore: 100,
      };

      mockPrismaService.credit.findUnique.mockResolvedValue(mockMetrics);
      mockPrismaService.credit.update.mockResolvedValue({
        id,
        dynamicScore: 100,
      });

      const result = await service.updateDynamicScore(id);

      expect(result).toBe(100);
      expect(prisma.credit.update).toHaveBeenCalledWith({
        where: { id },
        data: { dynamicScore: 100 },
      });
    });
  });
});
