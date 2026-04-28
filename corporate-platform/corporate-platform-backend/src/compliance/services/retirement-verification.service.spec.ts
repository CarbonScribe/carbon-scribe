import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RetirementVerificationService } from './retirement-verification.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { SorobanService } from '../../stellar/soroban/soroban.service';
import { RetirementTrackerService } from '../../stellar/soroban/contracts/retirement-tracker.service';
import { SecurityService } from '../../security/security.service';
import {
  VerifyRetirementDto,
  OffsetClaimStatus,
  ComplianceFramework,
} from '../dto/retirement-verification.dto';

describe('RetirementVerificationService', () => {
  let service: RetirementVerificationService;

  const mockPrismaService = {
    credit: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    retirement: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    corsiaEligibleCredit: {
      findMany: jest.fn(),
    },
    contractCall: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    retirementVerification: {
      create: jest.fn(),
    },
  };

  const mockSorobanService = {
    simulateContractCall: jest.fn(),
    getTransaction: jest.fn(),
  };

  const mockRetirementTrackerService = {
    getContractId: jest
      .fn()
      .mockReturnValue(
        'CCDCE6N7Q27TZW6Z6W3DPDCNOGHWFSOQUQPSRRZIY7AEHNOYZMNFDFVU',
      ),
    simulate: jest.fn(),
  };

  const mockSecurityService = {
    logEvent: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetirementVerificationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SorobanService, useValue: mockSorobanService },
        {
          provide: RetirementTrackerService,
          useValue: mockRetirementTrackerService,
        },
        { provide: SecurityService, useValue: mockSecurityService },
      ],
    }).compile();

    service = module.get<RetirementVerificationService>(
      RetirementVerificationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyRetirements', () => {
    it('should verify a batch of tokens successfully', async () => {
      const companyId = 'company-123';
      const dto: VerifyRetirementDto = {
        tokens: [{ tokenId: 'token-1' }, { tokenId: 'token-2' }],
        framework: ComplianceFramework.CORSIA,
      };

      mockPrismaService.credit.findFirst.mockImplementation(({ where }) => {
        if (where.id === 'token-1') {
          return Promise.resolve({
            id: 'token-1',
            retirements: [
              { id: 'ret-1', companyId, amount: 100, retiredAt: new Date() },
            ],
          });
        }
        return Promise.resolve({
          id: 'token-2',
          retirements: [
            { id: 'ret-2', companyId, amount: 200, retiredAt: new Date() },
          ],
        });
      });

      mockSorobanService.simulateContractCall.mockResolvedValue({
        result: { status: 'confirmed' },
        contractId: 'test',
        methodName: 'test',
      });

      mockPrismaService.corsiaEligibleCredit.findMany.mockResolvedValue([]);
      mockPrismaService.contractCall.findMany.mockResolvedValue([]);
      mockPrismaService.retirementVerification.create.mockResolvedValue(
        {} as any,
      );

      const result = await service.verifyRetirements(companyId, dto);

      expect(result).toBeDefined();
      expect(result.totalTokens).toBe(2);
      expect(result.verified).toBe(true);
      expect(result.verifiedTokens).toBe(2);
      expect(mockSecurityService.logEvent).toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty tokens array', async () => {
      const dto: VerifyRetirementDto = { tokens: [] };

      await expect(
        service.verifyRetirements('company-123', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for batch exceeding maximum size', async () => {
      const tokens = Array.from({ length: 101 }, (_, i) => ({
        tokenId: `token-${i}`,
      }));
      const dto: VerifyRetirementDto = { tokens };

      await expect(
        service.verifyRetirements('company-123', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle token not found', async () => {
      mockPrismaService.credit.findFirst.mockResolvedValue(null);
      mockPrismaService.retirementVerification.create.mockResolvedValue(
        {} as any,
      );

      const dto: VerifyRetirementDto = {
        tokens: [{ tokenId: 'invalid-token' }],
      };

      const result = await service.verifyRetirements('company-123', dto);

      expect(result.results[0].status).toBe(OffsetClaimStatus.INVALID);
      expect(result.results[0].message).toContain('not found');
    });

    it('should handle token not retired', async () => {
      mockPrismaService.credit.findFirst.mockResolvedValue({
        id: 'token-1',
        retirements: [],
      });
      mockPrismaService.retirementVerification.create.mockResolvedValue(
        {} as any,
      );

      const dto: VerifyRetirementDto = {
        tokens: [{ tokenId: 'token-1' }],
      };

      const result = await service.verifyRetirements('company-123', dto);

      expect(result.results[0].status).toBe(OffsetClaimStatus.NOT_RETIRED);
    });

    it('should handle already claimed tokens', async () => {
      mockPrismaService.credit.findFirst.mockResolvedValue({
        id: 'token-1',
        retirements: [
          {
            id: 'ret-1',
            companyId: 'company-123',
            amount: 100,
            retiredAt: new Date(),
          },
        ],
      });

      mockSorobanService.simulateContractCall.mockResolvedValue({
        result: { status: 'confirmed' },
        contractId: 'test',
        methodName: 'test',
      });

      mockPrismaService.corsiaEligibleCredit.findMany.mockResolvedValue([
        {
          id: 'eligible-1',
          program: ComplianceFramework.CORSIA,
          retirement: { creditId: 'token-1', amount: 100 },
        },
      ]);
      mockPrismaService.contractCall.findMany.mockResolvedValue([]);
      mockPrismaService.retirementVerification.create.mockResolvedValue(
        {} as any,
      );

      const dto: VerifyRetirementDto = {
        tokens: [{ tokenId: 'token-1' }],
        framework: ComplianceFramework.CORSIA,
      };

      const result = await service.verifyRetirements('company-123', dto);

      expect(result.results[0].status).toBe(OffsetClaimStatus.ALREADY_CLAIMED);
      expect(result.results[0].remainingAmount).toBe(0);
    });
  });

  describe('getRetirementStatus', () => {
    it('should return retirement status for a token', async () => {
      const companyId = 'company-123';
      const tokenId = 'token-1';

      mockPrismaService.credit.findFirst.mockResolvedValue({
        id: tokenId,
        retirements: [
          { id: 'ret-1', companyId, amount: 100, retiredAt: new Date() },
        ],
      });

      mockPrismaService.retirement.findFirst.mockResolvedValue({
        id: 'ret-1',
        companyId,
        amount: 100,
      });

      mockSorobanService.simulateContractCall.mockResolvedValue({
        result: { status: 'confirmed' },
        contractId: 'test',
        methodName: 'test',
      });

      mockPrismaService.corsiaEligibleCredit.findMany.mockResolvedValue([]);
      mockPrismaService.contractCall.findMany.mockResolvedValue([]);

      const result = await service.getRetirementStatus(companyId, tokenId);

      expect(result).toBeDefined();
      expect(result.tokenId).toBe(tokenId);
      expect(result.isRetired).toBe(true);
      expect(result.totalAmount).toBe(100);
    });

    it('should throw NotFoundException for non-existent token', async () => {
      mockPrismaService.credit.findFirst.mockResolvedValue(null);

      await expect(
        service.getRetirementStatus('company-123', 'invalid-token'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyTokenForCompliance', () => {
    it('should return valid for properly retired token', async () => {
      const companyId = 'company-123';
      const tokenId = 'token-1';
      const framework = ComplianceFramework.CORSIA;

      mockPrismaService.credit.findFirst.mockResolvedValue({
        id: tokenId,
        retirements: [
          { id: 'ret-1', companyId, amount: 100, retiredAt: new Date() },
        ],
      });

      mockPrismaService.retirement.findFirst.mockResolvedValue({
        id: 'ret-1',
        companyId,
        amount: 100,
      });

      mockSorobanService.simulateContractCall.mockResolvedValue({
        result: { status: 'confirmed' },
        contractId: 'test',
        methodName: 'test',
      });

      mockPrismaService.corsiaEligibleCredit.findMany.mockResolvedValue([]);
      mockPrismaService.contractCall.findMany.mockResolvedValue([]);

      const result = await service.verifyTokenForCompliance(
        companyId,
        tokenId,
        framework,
      );

      expect(result.valid).toBe(true);
      expect(result.message).toContain('valid');
    });

    it('should return invalid for non-retired token', async () => {
      mockPrismaService.credit.findFirst.mockResolvedValue({
        id: 'token-1',
        retirements: [],
      });

      mockPrismaService.retirement.findFirst.mockResolvedValue(null);
      mockSorobanService.simulateContractCall.mockResolvedValue({
        result: null,
        contractId: 'test',
        methodName: 'test',
      });
      mockPrismaService.corsiaEligibleCredit.findMany.mockResolvedValue([]);
      mockPrismaService.contractCall.findMany.mockResolvedValue([]);

      const result = await service.verifyTokenForCompliance(
        'company-123',
        'token-1',
        ComplianceFramework.CORSIA,
      );

      expect(result.valid).toBe(false);
      expect(result.message).toContain('not been retired');
    });

    it('should return invalid for insufficient amount', async () => {
      mockPrismaService.credit.findFirst.mockResolvedValue({
        id: 'token-1',
        retirements: [
          {
            id: 'ret-1',
            companyId: 'company-123',
            amount: 50,
            retiredAt: new Date(),
          },
        ],
      });

      mockPrismaService.retirement.findFirst.mockResolvedValue({
        id: 'ret-1',
        companyId: 'company-123',
        amount: 50,
      });

      mockSorobanService.simulateContractCall.mockResolvedValue({
        result: { status: 'confirmed' },
        contractId: 'test',
        methodName: 'test',
      });

      mockPrismaService.corsiaEligibleCredit.findMany.mockResolvedValue([
        {
          id: 'eligible-1',
          program: ComplianceFramework.CORSIA,
          updatedAt: new Date(),
          retirement: { creditId: 'token-1', amount: 30 },
        },
      ]);
      mockPrismaService.contractCall.findMany.mockResolvedValue([]);

      const result = await service.verifyTokenForCompliance(
        'company-123',
        'token-1',
        ComplianceFramework.CORSIA,
        30,
      );

      expect(result.valid).toBe(false);
      expect(result.message).toContain('insufficient');
    });
  });

  describe('blockDoubleClaim', () => {
    it('should return empty array when no tokens are claimed', async () => {
      const companyId = 'company-123';
      const tokenIds = ['token-1', 'token-2'];
      const framework = ComplianceFramework.CORSIA;

      mockPrismaService.credit.findFirst.mockResolvedValue({
        id: 'token-1',
        retirements: [
          { id: 'ret-1', companyId, amount: 100, retiredAt: new Date() },
        ],
      });

      mockPrismaService.retirement.findFirst.mockResolvedValue({
        id: 'ret-1',
        companyId,
        amount: 100,
      });

      mockSorobanService.simulateContractCall.mockResolvedValue({
        result: { status: 'confirmed' },
        contractId: 'test',
        methodName: 'test',
      });

      mockPrismaService.corsiaEligibleCredit.findMany.mockResolvedValue([]);
      mockPrismaService.contractCall.findMany.mockResolvedValue([]);

      const result = await service.blockDoubleClaim(
        companyId,
        [tokenIds[0]],
        framework,
      );

      expect(result.blocked).toBe(false);
      expect(result.blockedTokens).toHaveLength(0);
    });

    it('should return claimed tokens', async () => {
      const companyId = 'company-123';
      const framework = ComplianceFramework.CORSIA;

      mockPrismaService.credit.findFirst.mockResolvedValue({
        id: 'token-1',
        retirements: [
          { id: 'ret-1', companyId, amount: 100, retiredAt: new Date() },
        ],
      });

      mockPrismaService.retirement.findFirst.mockResolvedValue({
        id: 'ret-1',
        companyId,
        amount: 100,
      });

      mockSorobanService.simulateContractCall.mockResolvedValue({
        result: { status: 'confirmed' },
        contractId: 'test',
        methodName: 'test',
      });

      mockPrismaService.corsiaEligibleCredit.findMany.mockResolvedValue([
        {
          id: 'eligible-1',
          program: ComplianceFramework.CORSIA,
          updatedAt: new Date(),
          retirement: { creditId: 'token-1', companyId, amount: 100 },
        },
      ]);
      mockPrismaService.contractCall.findMany.mockResolvedValue([]);

      const result = await service.blockDoubleClaim(
        companyId,
        ['token-1'],
        framework,
      );

      expect(result.blocked).toBe(true);
      expect(result.blockedTokens).toContain('token-1');
    });
  });

  describe('getVerificationHistory', () => {
    it('should return verification history from contract calls', async () => {
      const companyId = 'company-123';

      mockPrismaService.contractCall.findMany.mockResolvedValue([
        {
          id: 'call-1',
          contractId:
            'CCDCE6N7Q27TZW6Z6W3DPDCNOGHWFSOQUQPSRRZIY7AEHNOYZMNFDFVU',
          methodName: 'check_retirement_status',
          args: [{ type: 'u64', value: '42' }],
          status: 'CONFIRMED',
          submittedAt: new Date('2026-01-15T10:00:00.000Z'),
          confirmedAt: new Date('2026-01-15T10:01:00.000Z'),
        },
        {
          id: 'call-2',
          contractId:
            'CCDCE6N7Q27TZW6Z6W3DPDCNOGHWFSOQUQPSRRZIY7AEHNOYZMNFDFVU',
          methodName: 'verify_retirement',
          args: [{ type: 'u64', value: '43' }],
          status: 'CONFIRMED',
          submittedAt: new Date('2026-01-14T08:00:00.000Z'),
          confirmedAt: new Date('2026-01-14T08:01:00.000Z'),
        },
      ]);

      mockPrismaService.contractCall.count = jest.fn().mockResolvedValue(2);

      const result = await service.getVerificationHistory(companyId);

      expect(result).toBeDefined();
      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].status).toBe('CONFIRMED');
      expect(result.items[0].tokenId).toBe('42');
    });

    it('should apply pagination parameters', async () => {
      mockPrismaService.contractCall.findMany.mockResolvedValue([]);
      mockPrismaService.contractCall.count = jest.fn().mockResolvedValue(0);

      const result = await service.getVerificationHistory('company-123', {
        limit: 10,
        offset: 5,
        tokenId: 'token-1',
        framework: ComplianceFramework.CORSIA,
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.contractCall.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 5,
        }),
      );
    });

    it('should cap limit at 100', async () => {
      mockPrismaService.contractCall.findMany.mockResolvedValue([]);
      mockPrismaService.contractCall.count = jest.fn().mockResolvedValue(0);

      await service.getVerificationHistory('company-123', {
        limit: 200,
      });

      expect(mockPrismaService.contractCall.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });
  });
});
