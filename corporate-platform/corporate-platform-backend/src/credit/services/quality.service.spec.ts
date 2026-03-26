import { Test, TestingModule } from '@nestjs/testing';
import { QualityService } from './quality.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('QualityService', () => {
  let service: QualityService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      credit: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [QualityService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(QualityService);
  });

  it('should compute dynamic score correctly', async () => {
    prisma.credit.findFirst.mockResolvedValueOnce({
      id: 'c1',
      verificationScore: 80,
      additionalityScore: 70,
      permanenceScore: 90,
      leakageScore: 10,
      cobenefitsScore: 60,
      transparencyScore: 50,
    });

    const result = await service.getQualityBreakdown('c1');
    expect(result.dynamicScore).toBe(77);
    expect(result.verificationScore).toBe(80);
  });
});
