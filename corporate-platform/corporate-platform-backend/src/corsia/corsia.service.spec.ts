import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CorsiaService } from './corsia.service';
import { PrismaService } from '../shared/database/prisma.service';
import { SecurityService } from '../security/security.service';
import { FlightEmissionsService } from './services/flight-emissions.service';
import { OffsetRequirementService } from './services/offset-requirement.service';
import { EmissionsReportService } from './services/emissions-report.service';
import { EligibleFuelsService } from './services/eligible-fuels.service';
import { VerifierService } from './services/verifier.service';
import { RetirementVerificationService } from '../compliance/services/retirement-verification.service';
import {
  ComplianceFramework,
  OffsetClaimStatus,
} from '../compliance/dto/retirement-verification.dto';

describe('CorsiaService', () => {
  let service: CorsiaService;

  const prismaMock = {
    flightRecord: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { co2Emissions: 0 } }),
    },
    corsiaComplianceYear: {
      upsert: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    retirement: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    corsiaEligibleCredit: {
      upsert: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const securityMock = {
    logEvent: jest.fn().mockResolvedValue(undefined),
  };

  const retirementVerificationMock = {
    verifyRetirements: jest.fn(),
    getRetirementStatus: jest.fn(),
    verifyTokenForCompliance: jest.fn(),
    blockDoubleClaim: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorsiaService,
        FlightEmissionsService,
        OffsetRequirementService,
        EmissionsReportService,
        EligibleFuelsService,
        VerifierService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SecurityService, useValue: securityMock },
        {
          provide: RetirementVerificationService,
          useValue: retirementVerificationMock,
        },
      ],
    }).compile();

    service = module.get<CorsiaService>(CorsiaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('lists eligible fuels', () => {
    const fuels = service.listEligibleFuels();
    expect(fuels.length).toBeGreaterThan(0);
  });

  it('throws when batch payload is empty', async () => {
    await expect(service.recordFlightsBatch('company-1', [])).rejects.toThrow(
      'flights must contain at least one record',
    );
  });

  describe('validateCredits', () => {
    it('should throw when retirementIds is empty', async () => {
      await expect(service.validateCredits('company-123', [])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when tokens fail verification', async () => {
      const companyId = 'company-123';
      const retirementIds = ['ret-1'];

      prismaMock.retirement.findMany.mockResolvedValue([
        {
          id: 'ret-1',
          companyId,
          amount: 100,
          creditId: 'credit-1',
          credit: {
            verificationStandard: 'VERRA',
            methodology: 'forestry',
            vintage: 2022,
          },
        },
      ]);

      retirementVerificationMock.verifyRetirements.mockResolvedValue({
        verified: false,
        totalTokens: 1,
        verifiedTokens: 0,
        claimedTokens: 1,
        notRetiredTokens: 0,
        results: [
          {
            tokenId: 'credit-1',
            status: OffsetClaimStatus.ALREADY_CLAIMED,
            message: 'Token already claimed for CORSIA',
            onChainVerified: true,
          },
        ],
        timestamp: new Date().toISOString(),
      });

      await expect(
        service.validateCredits(companyId, retirementIds),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate and save CORSIA eligible credits when tokens are verified', async () => {
      const companyId = 'company-123';
      const retirementIds = ['ret-1'];

      prismaMock.retirement.findMany.mockResolvedValue([
        {
          id: 'ret-1',
          companyId,
          amount: 100,
          creditId: 'credit-1',
          credit: {
            verificationStandard: 'VERRA',
            methodology: 'forestry',
            vintage: 2022,
          },
        },
      ]);

      retirementVerificationMock.verifyRetirements.mockResolvedValue({
        verified: true,
        totalTokens: 1,
        verifiedTokens: 1,
        claimedTokens: 0,
        notRetiredTokens: 0,
        results: [
          {
            tokenId: 'credit-1',
            status: OffsetClaimStatus.VERIFIED,
            message: 'Token verified',
            onChainVerified: true,
          },
        ],
        timestamp: new Date().toISOString(),
      });

      prismaMock.corsiaEligibleCredit.upsert.mockResolvedValue({
        id: 'eligible-1',
        companyId,
        program: 'VERRA',
        creditType: 'forestry',
        vintageYear: 2022,
        eligible: true,
        eligibilityMemo: null,
      });

      const result = await service.validateCredits(companyId, retirementIds);

      expect(result.count).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].eligible).toBe(true);
      expect(retirementVerificationMock.verifyRetirements).toHaveBeenCalledWith(
        companyId,
        expect.objectContaining({
          framework: ComplianceFramework.CORSIA,
        }),
      );
    });
  });
});
