import { Test, TestingModule } from '@nestjs/testing';
import { CbamService } from './cbam.service';
import { GoodsClassificationService } from './services/goods-classification.service';
import { EmbeddedEmissionsService } from './services/embedded-emissions.service';
import { QuarterlyReportService } from './services/quarterly-report.service';
import { CertificateTrackingService } from './services/certificate-tracking.service';
import { PrismaService } from '../shared/database/prisma.service';
import { SecurityService } from '../security/security.service';

describe('CbamService', () => {
  let service: CbamService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CbamService,
        GoodsClassificationService,
        EmbeddedEmissionsService,
        QuarterlyReportService,
        CertificateTrackingService,
        {
          provide: PrismaService,
          useValue: {
            importDeclaration: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
            cbamGoods: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            cbamQuarterlyReport: {
              upsert: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: SecurityService,
          useValue: {
            logEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CbamService>(CbamService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateEmissions', () => {
    it('should calculate emissions with actual data', async () => {
      const mockGood = {
        id: 'test-id',
        companyId: 'company-123',
        cnCode: '123456',
        goodsName: 'Test Cement',
        sector: 'CEMENT',
        defaultValue: 0.94,
        unit: 'tCO2e/tonne',
      };

      (prisma.cbamGoods.findUnique as jest.Mock).mockResolvedValue(mockGood);

      const result = await service.calculateEmissions('company-123', {
        goodsId: 'test-id',
        quantity: 100,
        quantityUnit: 'tonnes',
        countryOfOrigin: 'CN',
        actualEmissions: 95,
      });

      expect(result.calculationMethod).toBe('ACTUAL');
      expect(result.totalEmissions).toBe(9500);
    });

    it('should calculate emissions with default values', async () => {
      const mockGood = {
        id: 'test-id',
        companyId: 'company-123',
        cnCode: '123456',
        goodsName: 'Test Cement',
        sector: 'CEMENT',
        defaultValue: 0.94,
        unit: 'tCO2e/tonne',
      };

      (prisma.cbamGoods.findUnique as jest.Mock).mockResolvedValue(mockGood);

      const result = await service.calculateEmissions('company-123', {
        goodsId: 'test-id',
        quantity: 100,
        quantityUnit: 'tonnes',
        countryOfOrigin: 'CN',
      });

      expect(result.calculationMethod).toBe('DEFAULT');
      expect(result.totalEmissions).toBeGreaterThan(0);
    });
  });

  describe('getCbamSectors', () => {
    it('should return all CBAM sectors', async () => {
      const sectors = await service.getCbamSectors();
      expect(sectors.length).toBe(6);
      expect(sectors.map((s) => s.code)).toEqual([
        'CEMENT',
        'IRON_STEEL',
        'ALUMINIUM',
        'FERTILIZERS',
        'ELECTRICITY',
        'HYDROGEN',
      ]);
    });
  });
});
