import { GhgProtocolService } from './ghg-protocol.service';
import {
  AuditAction,
  AuditEventType,
} from '../audit-trail/interfaces/audit-event.interface';
import {
  ComplianceFramework,
  OffsetClaimStatus,
} from '../compliance/dto/retirement-verification.dto';

describe('GhgProtocolService', () => {
  let service: GhgProtocolService;
  let prisma: any;
  let scope1Service: { calculate: jest.Mock };
  let scope2Service: { calculate: jest.Mock };
  let scope3Service: { calculate: jest.Mock };
  let emissionFactorsService: {
    resolveFactor: jest.Mock;
    listFactors: jest.Mock;
  };
  let inventoryService: {
    getInventory: jest.Mock;
    getAnnualInventory: jest.Mock;
    getTrends: jest.Mock;
  };
  let auditTrailService: { createAuditEvent: jest.Mock };
  let retirementVerificationService: { verifyRetirements: jest.Mock };

  beforeEach(() => {
    prisma = {
      emissionSource: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      emissionRecord: {
        create: jest.fn(),
      },
      framework: {
        findFirst: jest.fn(),
      },
      compliance: {
        findFirst: jest.fn(),
      },
    };
    scope1Service = { calculate: jest.fn() };
    scope2Service = { calculate: jest.fn() };
    scope3Service = { calculate: jest.fn() };
    emissionFactorsService = {
      resolveFactor: jest.fn(),
      listFactors: jest.fn(),
    };
    inventoryService = {
      getInventory: jest.fn(),
      getAnnualInventory: jest.fn(),
      getTrends: jest.fn(),
    };
    auditTrailService = {
      createAuditEvent: jest.fn(),
    };
    retirementVerificationService = {
      verifyRetirements: jest.fn(),
    };

    service = new GhgProtocolService(
      prisma,
      scope1Service as any,
      scope2Service as any,
      scope3Service as any,
      emissionFactorsService as any,
      inventoryService as any,
      auditTrailService as any,
      retirementVerificationService as any,
    );
  });

  it('records a scope 2 emission and writes an audit event', async () => {
    prisma.emissionSource.findFirst.mockResolvedValue({
      id: 'source-1',
      companyId: 'company-1',
      scope: 2,
      category: 'PURCHASED_ELECTRICITY',
      activityType: 'ELECTRICITY',
      unit: 'kWh',
      isActive: true,
    });
    prisma.framework.findFirst.mockResolvedValue({
      code: 'GHG',
      requirements: [{ id: 'scope-2-accounting', name: 'Scope 2 accounting' }],
    });
    prisma.compliance.findFirst.mockResolvedValue({ status: 'in_progress' });
    prisma.emissionSource.findMany.mockResolvedValue([{ scope: 2 }]);
    emissionFactorsService.resolveFactor.mockResolvedValue({
      id: 'factor-1',
      source: 'EPA',
      activityType: 'ELECTRICITY',
      unit: 'kWh',
      region: 'US',
      co2ePerUnit: 0.385,
      validFrom: new Date('2025-01-01T00:00:00.000Z'),
      validTo: null,
      methodology: 'location-based',
      isActive: true,
    });
    scope2Service.calculate.mockReturnValue({
      methodology: 'GHG Protocol Scope 2 location-based',
      co2e: 96.25,
      details: { renewableEnergyPercentage: 0, transmissionLossFactor: 1 },
    });
    prisma.emissionRecord.create.mockResolvedValue({
      id: 'record-1',
      co2e: 96.25,
      source: { scope: 2, category: 'PURCHASED_ELECTRICITY' },
    });

    const result = await service.recordEmission(
      'company-1',
      {
        sourceId: 'source-1',
        periodStart: '2025-01-01T00:00:00.000Z',
        periodEnd: '2025-01-31T23:59:59.999Z',
        activityValue: 250,
      },
      {
        sub: 'user-1',
        email: 'test@example.com',
        companyId: 'company-1',
        role: 'manager',
        sessionId: 'session-1',
      },
    );

    expect(result.record.id).toBe('record-1');
    expect(scope2Service.calculate).toHaveBeenCalled();
    expect(auditTrailService.createAuditEvent).toHaveBeenCalledWith(
      'company-1',
      'user-1',
      expect.objectContaining({
        eventType: AuditEventType.GHG_CALCULATION,
        action: AuditAction.CREATE,
        entityType: 'EmissionRecord',
      }),
    );
  });

  describe('verifyOffsetsForCompliance', () => {
    it('should return valid result when all offsets are verified', async () => {
      const companyId = 'company-123';
      const tokenIds = ['token-1', 'token-2'];

      retirementVerificationService.verifyRetirements.mockResolvedValue({
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
      expect(result.results[0].valid).toBe(true);
      expect(result.results[1].valid).toBe(true);
      expect(
        retirementVerificationService.verifyRetirements,
      ).toHaveBeenCalledWith(companyId, {
        tokens: tokenIds.map((id) => ({ tokenId: id })),
        framework: ComplianceFramework.GHG,
      });
    });

    it('should return invalid result when some offsets are already claimed', async () => {
      const companyId = 'company-123';
      const tokenIds = ['token-1', 'token-2'];

      retirementVerificationService.verifyRetirements.mockResolvedValue({
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
      expect(result.results[0].valid).toBe(true);
      expect(result.results[1].valid).toBe(false);
    });

    it('should return invalid result when offsets are not retired', async () => {
      const companyId = 'company-123';
      const tokenIds = ['token-1'];

      retirementVerificationService.verifyRetirements.mockResolvedValue({
        verified: false,
        totalTokens: 1,
        verifiedTokens: 0,
        claimedTokens: 0,
        notRetiredTokens: 1,
        results: [
          {
            tokenId: 'token-1',
            status: OffsetClaimStatus.NOT_RETIRED,
            message: 'Not retired',
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
