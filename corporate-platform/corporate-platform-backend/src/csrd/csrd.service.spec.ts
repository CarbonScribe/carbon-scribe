import { Test, TestingModule } from '@nestjs/testing';
import { CsrdService } from './csrd.service';
import { PrismaService } from '../shared/database/prisma.service';
import { MaterialityAssessmentService } from './services/materiality-assessment.service';
import { EsrsDisclosureService } from './services/esrs-disclosure.service';
import { ReportGeneratorService } from './services/report-generator.service';
import { AssuranceService } from './services/assurance.service';
import { SecurityService } from '../security/security.service';
import { RetirementVerificationService } from '../compliance/services/retirement-verification.service';
import {
  ComplianceFramework,
  OffsetClaimStatus,
} from '../compliance/dto/retirement-verification.dto';
import { EsrsStandard } from './interfaces/disclosure.interface';

const MOCK_COMPANY = 'company-123';

const mockPrisma = {
  materialityAssessment: {
    count: jest.fn().mockResolvedValue(1),
  },
  esrsDisclosure: {
    groupBy: jest.fn().mockResolvedValue([
      { standard: 'ESRS E1', _count: 5 },
      { standard: 'ESRS S1', _count: 3 },
    ]),
  },
  csrdReport: {
    count: jest.fn().mockResolvedValue(1),
    findMany: jest
      .fn()
      .mockResolvedValue([
        { id: 'r1', reportingYear: 2024, status: 'SUBMITTED' },
      ]),
  },
};

const mockMaterialityService = {
  createAssessment: jest.fn().mockResolvedValue({
    id: 'assess-1',
    assessmentYear: 2024,
    status: 'IN_PROGRESS',
  }),
  getCurrent: jest.fn().mockResolvedValue({
    id: 'assess-1',
    status: 'COMPLETED',
    assessmentYear: 2024,
  }),
};

const mockDisclosureService = {
  record: jest.fn().mockResolvedValue({
    id: 'disc-1',
    standard: 'ESRS E1',
    reportingPeriod: '2024',
  }),
  list: jest.fn().mockResolvedValue([
    { id: 'disc-1', standard: 'ESRS E1' },
    { id: 'disc-2', standard: 'ESRS S1' },
  ]),
  getRequirements: jest.fn().mockResolvedValue([
    {
      id: 'E1-6',
      standard: 'ESRS E1',
      requirement: 'E1-6',
      description: 'GHG emissions',
      dataPoints: ['scope1_tco2e'],
    },
  ]),
};

const mockReportService = {
  generate: jest.fn().mockResolvedValue({
    id: 'report-1',
    reportingYear: 2024,
    status: 'REVIEW',
  }),
};

const mockAssuranceService = {
  updateAssurance: jest.fn().mockResolvedValue({
    id: 'disc-1',
    assuranceLevel: 'LIMITED',
    assuredBy: 'Deloitte',
  }),
};

const mockSecurityService = {
  logEvent: jest.fn().mockResolvedValue(undefined),
};

const mockRetirementVerificationService = {
  verifyRetirements: jest.fn(),
};

describe('CsrdService', () => {
  let service: CsrdService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsrdService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: MaterialityAssessmentService,
          useValue: mockMaterialityService,
        },
        { provide: EsrsDisclosureService, useValue: mockDisclosureService },
        { provide: ReportGeneratorService, useValue: mockReportService },
        { provide: AssuranceService, useValue: mockAssuranceService },
        { provide: SecurityService, useValue: mockSecurityService },
        {
          provide: RetirementVerificationService,
          useValue: mockRetirementVerificationService,
        },
      ],
    }).compile();

    service = module.get<CsrdService>(CsrdService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assessMateriality', () => {
    const dto = {
      assessmentYear: 2024,
      impacts: [
        {
          id: 't1',
          name: 'Climate change',
          category: 'environmental' as const,
          impactScore: 4,
          financialScore: 3,
          justification: 'Significant emissions',
          relatedStandard: 'ESRS E1',
        },
      ],
      risks: [],
    };

    it('should delegate to materialityService and log a security event', async () => {
      const result = await service.assessMateriality(MOCK_COMPANY, dto as any);
      expect(mockMaterialityService.createAssessment).toHaveBeenCalledWith(
        MOCK_COMPANY,
        dto,
        'system',
      );
      expect(mockSecurityService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: MOCK_COMPANY, status: 'success' }),
      );
      expect(result.id).toBe('assess-1');
    });
  });

  describe('getCurrentMateriality', () => {
    it('should return the most recent assessment for the company', async () => {
      const result = await service.getCurrentMateriality(MOCK_COMPANY);
      expect(mockMaterialityService.getCurrent).toHaveBeenCalledWith(
        MOCK_COMPANY,
      );
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('recordDisclosure', () => {
    const dto = {
      reportingPeriod: '2024',
      standard: 'ESRS E1',
      disclosureRequirement: 'E1-6',
      dataPoint: 'scope1_tco2e',
      value: 1200,
    };

    it('should record a disclosure and log a security event', async () => {
      const result = await service.recordDisclosure(MOCK_COMPANY, dto as any);
      expect(mockDisclosureService.record).toHaveBeenCalledWith(
        MOCK_COMPANY,
        dto,
        'system',
      );
      expect(mockSecurityService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: MOCK_COMPANY }),
      );
      expect(result.id).toBe('disc-1');
    });
  });

  describe('listDisclosures', () => {
    it('should delegate to disclosureService with query params', async () => {
      const query = { standard: 'ESRS E1' };
      const result = await service.listDisclosures(MOCK_COMPANY, query);
      expect(mockDisclosureService.list).toHaveBeenCalledWith(
        MOCK_COMPANY,
        query,
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('getRequirements', () => {
    it('should return ESRS requirements for a given standard', async () => {
      const result = await service.getRequirements('ESRS E1');
      expect(mockDisclosureService.getRequirements).toHaveBeenCalledWith(
        'ESRS E1',
      );
      expect(result[0].standard).toBe('ESRS E1');
    });

    it('should return all requirements when no standard is provided', async () => {
      await service.getRequirements();
      expect(mockDisclosureService.getRequirements).toHaveBeenCalledWith(
        undefined,
      );
    });
  });

  describe('generateReport', () => {
    it('should generate a report in REVIEW status and log a security event', async () => {
      const result = await service.generateReport(MOCK_COMPANY, 2024);
      expect(mockReportService.generate).toHaveBeenCalledWith(
        MOCK_COMPANY,
        2024,
        'system',
      );
      expect(mockSecurityService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: MOCK_COMPANY }),
      );
      expect(result.status).toBe('REVIEW');
    });
  });

  describe('listReports', () => {
    it('should return reports ordered by year descending', async () => {
      const result = await service.listReports(MOCK_COMPANY);
      expect(mockPrisma.csrdReport.findMany).toHaveBeenCalledWith({
        where: { companyId: MOCK_COMPANY },
        orderBy: { reportingYear: 'desc' },
      });
      expect(result[0].reportingYear).toBe(2024);
    });
  });

  describe('updateAssurance', () => {
    it('should delegate to assurance service with correct args', async () => {
      const dto = { assuranceLevel: 'LIMITED' as const, assuredBy: 'Deloitte' };
      const result = await service.updateAssurance(MOCK_COMPANY, 'disc-1', dto);
      expect(mockAssuranceService.updateAssurance).toHaveBeenCalledWith(
        MOCK_COMPANY,
        'disc-1',
        'LIMITED',
        'Deloitte',
        'system',
      );
      expect(result.assuranceLevel).toBe('LIMITED');
      expect(result.assuredBy).toBe('Deloitte');
    });

    it('should support REASONABLE assurance level', async () => {
      mockAssuranceService.updateAssurance.mockResolvedValueOnce({
        id: 'disc-1',
        assuranceLevel: 'REASONABLE',
        assuredBy: 'PwC',
      });
      const dto = { assuranceLevel: 'REASONABLE' as const, assuredBy: 'PwC' };
      const result = await service.updateAssurance(MOCK_COMPANY, 'disc-1', dto);
      expect(result.assuranceLevel).toBe('REASONABLE');
    });
  });

  describe('verifyOffsetsForCompliance', () => {
    it('should return valid=true when all tokens are verified', async () => {
      mockRetirementVerificationService.verifyRetirements.mockResolvedValueOnce(
        {
          results: [
            {
              tokenId: 'tok-1',
              status: OffsetClaimStatus.VERIFIED,
              message: 'OK',
            },
            {
              tokenId: 'tok-2',
              status: OffsetClaimStatus.VERIFIED,
              message: 'OK',
            },
          ],
        },
      );
      const result = await service.verifyOffsetsForCompliance(MOCK_COMPANY, [
        'tok-1',
        'tok-2',
      ]);
      expect(result.valid).toBe(true);
      expect(result.totalValid).toBe(2);
      expect(result.totalTokens).toBe(2);
      expect(
        mockRetirementVerificationService.verifyRetirements,
      ).toHaveBeenCalledWith(
        MOCK_COMPANY,
        expect.objectContaining({ framework: ComplianceFramework.CSRD }),
      );
    });

    it('should return valid=false when some tokens fail verification', async () => {
      mockRetirementVerificationService.verifyRetirements.mockResolvedValueOnce(
        {
          results: [
            {
              tokenId: 'tok-1',
              status: OffsetClaimStatus.VERIFIED,
              message: 'OK',
            },
            {
              tokenId: 'tok-2',
              status: OffsetClaimStatus.ALREADY_CLAIMED,
              message: 'Double claim',
            },
          ],
        },
      );
      const result = await service.verifyOffsetsForCompliance(MOCK_COMPANY, [
        'tok-1',
        'tok-2',
      ]);
      expect(result.valid).toBe(false);
      expect(result.totalValid).toBe(1);
      expect(result.results[1].valid).toBe(false);
    });
  });

  describe('getReadinessScorecard', () => {
    it('should compute a non-zero score when assessments and disclosures exist', async () => {
      const result = await service.getReadinessScorecard(MOCK_COMPANY);
      expect(result.companyId).toBe(MOCK_COMPANY);
      expect(result.overallScore).toBeGreaterThan(0);
    });

    it('should mark doubleMaterialityComplete when completed assessments exist', async () => {
      const result = await service.getReadinessScorecard(MOCK_COMPANY);
      expect(result.milestones.doubleMaterialityComplete).toBe(true);
    });

    it('should not include covered standards in missingStandards', async () => {
      mockPrisma.esrsDisclosure.groupBy.mockResolvedValueOnce([
        { standard: 'ESRS E1', _count: 5 },
        { standard: 'ESRS S1', _count: 3 },
      ]);
      const result = await service.getReadinessScorecard(MOCK_COMPANY);
      expect(result.missingStandards).not.toContain(EsrsStandard.E1);
      expect(result.missingStandards).not.toContain(EsrsStandard.S1);
      expect(result.missingStandards).toContain(EsrsStandard.E2);
    });

    it('should return zero score when no data exists', async () => {
      mockPrisma.materialityAssessment.count.mockResolvedValueOnce(0);
      mockPrisma.esrsDisclosure.groupBy.mockResolvedValueOnce([]);
      mockPrisma.csrdReport.count.mockResolvedValueOnce(0);

      const result = await service.getReadinessScorecard(MOCK_COMPANY);
      expect(result.overallScore).toBe(0);
      expect(result.milestones.doubleMaterialityComplete).toBe(false);
      expect(result.milestones.esrsDisclosuresStarted).toBe(false);
      expect(result.missingStandards).toHaveLength(
        Object.values(EsrsStandard).length,
      );
    });

    it('should include coverage statistics', async () => {
      const result = await service.getReadinessScorecard(MOCK_COMPANY);
      expect(result.coverage).toBeDefined();
      expect(result.coverage.totalStandards).toBe(
        Object.values(EsrsStandard).length,
      );
      expect(result.coverage.standardsCovered).toBe(2);
    });
  });
});
