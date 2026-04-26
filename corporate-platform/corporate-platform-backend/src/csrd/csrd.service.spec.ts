import { Test, TestingModule } from '@nestjs/testing';
import { CsrdService } from './csrd.service';
import { PrismaService } from '../shared/database/prisma.service';
import { MaterialityAssessmentService } from './services/materiality-assessment.service';
import { EsrsDisclosureService } from './services/esrs-disclosure.service';
import { ReportGeneratorService } from './services/report-generator.service';
import { SecurityService } from '../security/security.service';
import { RetirementVerificationService } from '../compliance/services/retirement-verification.service';
import {
  ComplianceFramework,
  OffsetClaimStatus,
} from '../compliance/dto/retirement-verification.dto';

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

  const mockRetirementVerificationService = {
    verifyRetirements: jest.fn(),
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
        {
          provide: RetirementVerificationService,
          useValue: mockRetirementVerificationService,
        },
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

  describe('verifyOffsetsForCompliance', () => {
    it('should verify offsets and return valid result when all tokens are verified', async () => {
      const companyId = 'company-123';
      const tokenIds = ['token-1', 'token-2'];

      mockRetirementVerificationService.verifyRetirements.mockResolvedValue({
        verified: true,
        totalTokens: 2,
        verifiedTokens: 2,
        claimedTokens: 0,
        notRetiredTokens: 0,
        results: [
          {
            tokenId: 'token-1',
            status: OffsetClaimStatus.VERIFIED,
            message: 'Token verified',
            onChainVerified: true,
          },
          {
            tokenId: 'token-2',
            status: OffsetClaimStatus.VERIFIED,
            message: 'Token verified',
            onChainVerified: true,
          },
        ],
        timestamp: new Date().toISOString(),
      });

      const result = await service.verifyOffsetsForCompliance(
        companyId,
        tokenIds,
      );

      expect(result.valid).toBe(true);
      expect(result.totalValid).toBe(2);
      expect(result.totalTokens).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].valid).toBe(true);
      expect(result.results[1].valid).toBe(true);
      expect(
        mockRetirementVerificationService.verifyRetirements,
      ).toHaveBeenCalledWith(companyId, {
        tokens: tokenIds.map((id) => ({ tokenId: id })),
        framework: ComplianceFramework.CSRD,
      });
    });

    it('should return invalid result when some tokens are already claimed', async () => {
      const companyId = 'company-123';
      const tokenIds = ['token-1', 'token-2'];

      mockRetirementVerificationService.verifyRetirements.mockResolvedValue({
        verified: false,
        totalTokens: 2,
        verifiedTokens: 1,
        claimedTokens: 1,
        notRetiredTokens: 0,
        results: [
          {
            tokenId: 'token-1',
            status: OffsetClaimStatus.VERIFIED,
            message: 'Token verified',
            onChainVerified: true,
          },
          {
            tokenId: 'token-2',
            status: OffsetClaimStatus.ALREADY_CLAIMED,
            message: 'Already claimed',
            onChainVerified: true,
          },
        ],
        timestamp: new Date().toISOString(),
      });

      const result = await service.verifyOffsetsForCompliance(
        companyId,
        tokenIds,
      );

      expect(result.valid).toBe(false);
      expect(result.totalValid).toBe(1);
      expect(result.totalTokens).toBe(2);
      expect(result.results[0].valid).toBe(true);
      expect(result.results[1].valid).toBe(false);
    });

    it('should return invalid result when tokens are not retired', async () => {
      const companyId = 'company-123';
      const tokenIds = ['token-1'];

      mockRetirementVerificationService.verifyRetirements.mockResolvedValue({
        verified: false,
        totalTokens: 1,
        verifiedTokens: 0,
        claimedTokens: 0,
        notRetiredTokens: 1,
        results: [
          {
            tokenId: 'token-1',
            status: OffsetClaimStatus.NOT_RETIRED,
            message: 'Token not retired',
            onChainVerified: false,
          },
        ],
        timestamp: new Date().toISOString(),
      });

      const result = await service.verifyOffsetsForCompliance(
        companyId,
        tokenIds,
      );

      expect(result.valid).toBe(false);
      expect(result.totalValid).toBe(0);
      expect(result.results[0].valid).toBe(false);
    });
  });
});
