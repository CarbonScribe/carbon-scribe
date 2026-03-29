import { Test, TestingModule } from '@nestjs/testing';
import { CsrdService } from './csrd.service';
import { PrismaService } from '../shared/database/prisma.service';
import { MaterialityAssessmentService } from './services/materiality-assessment.service';
import { EsrsDisclosureService } from './services/esrs-disclosure.service';
import { ReportGeneratorService } from './services/report-generator.service';
import { SecurityService } from '../security/security.service';

describe('CsrdService', () => {
  let service: CsrdService;

  const mockPrismaService = {
    materialityAssessment: {
      count: jest.fn().mockResolvedValue(1),
    },
    esrsDisclosure: {
      count: jest.fn().mockResolvedValue(15),
    },
    csrdReport: {
      count: jest.fn().mockResolvedValue(2),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const mockMaterialityService = {
    createAssessment: jest.fn(),
    getCurrent: jest.fn(),
  };

  const mockDisclosureService = {
    record: jest.fn(),
    list: jest.fn(),
    getRequirements: jest.fn(),
  };

  const mockReportService = {
    generate: jest.fn(),
  };

  const mockSecurityService = {
    logEvent: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsrdService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: MaterialityAssessmentService,
          useValue: mockMaterialityService,
        },
        { provide: EsrsDisclosureService, useValue: mockDisclosureService },
        { provide: ReportGeneratorService, useValue: mockReportService },
        { provide: SecurityService, useValue: mockSecurityService },
      ],
    }).compile();

    service = module.get<CsrdService>(CsrdService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getReadinessScorecard', () => {
    it('should return a perfect score when assessments and disclosures are complete', async () => {
      const result = await service.getReadinessScorecard('company-123');
      expect(result.overallScore).toBe(100);
      expect(result.milestones.doubleMaterialityComplete).toBe(true);
    });
  });
});
