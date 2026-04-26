import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { SecurityService } from '../security/security.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { IpWhitelistGuard } from '../security/guards/ip-whitelist.guard';
import {
  CheckComplianceDto,
  ComplianceFramework,
  EntityType,
} from './dto/check-compliance.dto';
import { ComplianceStatus } from './dto/compliance-status.dto';
import {
  VerifyRetirementDto,
  OffsetClaimStatus,
} from './dto/retirement-verification.dto';

describe('ComplianceController', () => {
  let controller: ComplianceController;

  const mockComplianceService = {
    checkCompliance: jest.fn(),
    getComplianceStatus: jest.fn(),
    getComplianceReport: jest.fn(),
    verifyRetirementsForCompliance: jest.fn(),
    getRetirementStatus: jest.fn(),
    validateTokensForCompliance: jest.fn(),
    checkDoubleClaimRisk: jest.fn(),
    getVerificationHistory: jest.fn(),
  };

  const mockSecurityService = {
    logEvent: jest.fn().mockResolvedValue(undefined),
  };

  const mockUser = {
    sub: 'user-123',
    email: 'test@example.com',
    companyId: 'company-123',
    role: 'manager',
    sessionId: 'session-123',
  };

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [ComplianceController],
      providers: [
        {
          provide: ComplianceService,
          useValue: mockComplianceService,
        },
        {
          provide: SecurityService,
          useValue: mockSecurityService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(IpWhitelistGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<ComplianceController>(ComplianceController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkCompliance', () => {
    it('should successfully check compliance', async () => {
      const dto: CheckComplianceDto = {
        framework: ComplianceFramework.CBAM,
        entityType: EntityType.CREDIT,
        entityId: 'credit-123',
      };

      const mockResult = {
        framework: ComplianceFramework.CBAM,
        entityId: 'credit-123',
        entityType: EntityType.CREDIT,
        status: ComplianceStatus.COMPLIANT,
        timestamp: new Date(),
        issues: [],
        requirements: [],
        recommendations: [],
      };

      mockComplianceService.checkCompliance.mockResolvedValue(mockResult);

      const result = await controller.checkCompliance(mockUser, dto);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(mockComplianceService.checkCompliance).toHaveBeenCalledWith(
        mockUser.companyId,
        dto,
      );
    });

    it('should throw error if required fields are missing', async () => {
      const dto: any = {
        framework: ComplianceFramework.CBAM,
      };

      await expect(controller.checkCompliance(mockUser, dto)).rejects.toThrow();
    });
  });

  describe('getComplianceStatus', () => {
    it('should successfully get compliance status', async () => {
      const entityId = 'credit-123';
      const mockResult = [
        {
          entityId,
          framework: ComplianceFramework.CBAM,
          status: ComplianceStatus.COMPLIANT,
        },
      ];

      mockComplianceService.getComplianceStatus.mockResolvedValue(mockResult);

      const result = await controller.getComplianceStatus(mockUser, entityId);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(mockSecurityService.logEvent).toHaveBeenCalled();
    });

    it('should throw error if entityId is missing', async () => {
      await expect(
        controller.getComplianceStatus(mockUser, ''),
      ).rejects.toThrow();
    });
  });

  describe('verifyRetirement', () => {
    it('should verify retirements for a batch of tokens', async () => {
      const dto: VerifyRetirementDto = {
        tokens: [{ tokenId: 'token-1' }, { tokenId: 'token-2' }],
        framework: ComplianceFramework.CORSIA,
      };

      const mockResult = {
        verified: true,
        totalTokens: 2,
        verifiedTokens: 2,
        claimedTokens: 0,
        notRetiredTokens: 0,
        results: [
          {
            tokenId: 'token-1',
            status: OffsetClaimStatus.VERIFIED,
            message: 'Verified',
            onChainVerified: true,
          },
          {
            tokenId: 'token-2',
            status: OffsetClaimStatus.VERIFIED,
            message: 'Verified',
            onChainVerified: true,
          },
        ],
        timestamp: new Date().toISOString(),
      };

      mockComplianceService.verifyRetirementsForCompliance.mockResolvedValue(
        mockResult,
      );

      const result = await controller.verifyRetirement(mockUser, dto);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(
        mockComplianceService.verifyRetirementsForCompliance,
      ).toHaveBeenCalledWith(mockUser.companyId, dto);
      expect(mockSecurityService.logEvent).toHaveBeenCalled();
    });

    it('should throw BadRequestException when tokens array is empty', async () => {
      const dto: VerifyRetirementDto = { tokens: [] };

      await expect(
        controller.verifyRetirement(mockUser, dto),
      ).rejects.toThrow();
    });
  });

  describe('getRetirementStatus', () => {
    it('should get retirement status for a token', async () => {
      const mockResult = {
        tokenId: 'token-1',
        isRetired: true,
        totalAmount: 100,
        claimedAmount: 0,
        remainingAmount: 100,
        retirementVerified: true,
        blockchainStatus: 'CONFIRMED',
        claims: [],
        auditTrail: [],
      };

      mockComplianceService.getRetirementStatus.mockResolvedValue(mockResult);

      const result = await controller.getRetirementStatus(mockUser, 'token-1');

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(mockComplianceService.getRetirementStatus).toHaveBeenCalledWith(
        mockUser.companyId,
        'token-1',
        undefined,
      );
    });

    it('should throw BadRequestException when tokenId is missing', async () => {
      await expect(
        controller.getRetirementStatus(mockUser, ''),
      ).rejects.toThrow();
    });
  });

  describe('checkDoubleClaimRisk', () => {
    it('should check double claim risk for tokens', async () => {
      const mockResult = {
        riskLevel: 'LOW',
        atRiskTokens: [],
        message: 'No double-claim risk detected.',
      };

      mockComplianceService.checkDoubleClaimRisk.mockResolvedValue(mockResult);

      const result = await controller.checkDoubleClaimRisk(mockUser, {
        tokenIds: ['token-1', 'token-2'],
        framework: ComplianceFramework.CORSIA,
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.riskLevel).toBe('LOW');
      expect(mockSecurityService.logEvent).toHaveBeenCalled();
    });

    it('should throw BadRequestException when tokenIds is empty', async () => {
      await expect(
        controller.checkDoubleClaimRisk(mockUser, {
          tokenIds: [],
          framework: ComplianceFramework.CORSIA,
        }),
      ).rejects.toThrow();
    });
  });

  describe('validateTokens', () => {
    it('should validate tokens for compliance', async () => {
      const mockResult = {
        valid: true,
        results: [
          { tokenId: 'token-1', valid: true, message: 'Valid for CORSIA' },
        ],
      };

      mockComplianceService.validateTokensForCompliance.mockResolvedValue(
        mockResult,
      );

      const result = await controller.validateTokens(mockUser, {
        tokenIds: ['token-1'],
        framework: ComplianceFramework.CORSIA,
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.valid).toBe(true);
      expect(mockSecurityService.logEvent).toHaveBeenCalled();
    });

    it('should throw BadRequestException when tokenIds is empty', async () => {
      await expect(
        controller.validateTokens(mockUser, {
          tokenIds: [],
          framework: ComplianceFramework.CORSIA,
        }),
      ).rejects.toThrow();
    });
  });

  describe('getVerificationHistory', () => {
    it('should return verification history', async () => {
      const mockResult = {
        total: 5,
        items: [
          {
            id: 'call-1',
            tokenId: 'token-1',
            status: 'CONFIRMED',
            onChainVerified: true,
            verifiedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      };

      mockComplianceService.getVerificationHistory.mockResolvedValue(
        mockResult,
      );

      const result = await controller.getVerificationHistory(
        mockUser,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(mockComplianceService.getVerificationHistory).toHaveBeenCalledWith(
        mockUser.companyId,
        {
          tokenId: undefined,
          framework: undefined,
          limit: undefined,
          offset: undefined,
        },
      );
    });

    it('should pass query parameters to the service', async () => {
      const mockResult = { total: 0, items: [] };

      mockComplianceService.getVerificationHistory.mockResolvedValue(
        mockResult,
      );

      await controller.getVerificationHistory(
        mockUser,
        'token-1',
        ComplianceFramework.CORSIA,
        '10',
        '5',
      );

      expect(mockComplianceService.getVerificationHistory).toHaveBeenCalledWith(
        mockUser.companyId,
        {
          tokenId: 'token-1',
          framework: ComplianceFramework.CORSIA,
          limit: 10,
          offset: 5,
        },
      );
    });
  });
});
