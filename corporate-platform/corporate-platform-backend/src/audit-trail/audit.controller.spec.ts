import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { RetirementAuditHashService } from './services/retirement-audit-hash.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('AuditController', () => {
  let controller: AuditController;
  let service: jest.Mocked<RetirementAuditHashService>;

  beforeEach(async () => {
    const mockService = {
      anchorHash: jest.fn(),
      verifyHash: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: RetirementAuditHashService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<AuditController>(AuditController);
    service = module.get(RetirementAuditHashService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('anchorHash', () => {
    it('should call RetirementAuditHashService.anchorHash with correct parameters', async () => {
      const mockUser: JwtPayload = {
        sub: 'user-123',
        companyId: 'company-456',
        email: 'test@example.com',
        role: 'admin',
        sessionId: 'session-123',
        iat: 12345,
        exp: 67890,
      };

      const mockDto = {
        tokenId: 42,
        auditEventId: 'event-789',
        auditRecord: { amount: 100, project: 'wind' },
      };

      const expectedResult = {
        anchorId: 'anchor-1',
        tokenId: 42,
        auditHash: 'abcdef123456',
        onChainTxHash: 'txhash123',
        idempotent: false,
        anchorStatus: 'CONFIRMED' as const,
        anchoredAt: new Date().toISOString(),
      };

      service.anchorHash.mockResolvedValue(expectedResult);

      const result = await controller.anchorHash(mockUser, mockDto);

      expect(service.anchorHash).toHaveBeenCalledWith({
        tokenId: mockDto.tokenId,
        auditEventId: mockDto.auditEventId,
        auditRecord: mockDto.auditRecord,
        companyId: mockUser.companyId,
        userId: mockUser.sub,
      });
      expect(result).toEqual(expectedResult);
    });
  });

  describe('verifyHash', () => {
    it('should call RetirementAuditHashService.verifyHash with correct parameters', async () => {
      const mockUser: JwtPayload = {
        sub: 'user-123',
        companyId: 'company-456',
        email: 'test@example.com',
        role: 'admin',
        sessionId: 'session-123',
        iat: 12345,
        exp: 67890,
      };

      const tokenId = 42;

      const expectedResult = {
        tokenId,
        auditHash: 'abcdef123456',
        onChainRecord: { amount: 100 },
        txProofConfirmed: true,
        onChainTxHash: 'txhash123',
        anchorStatus: 'CONFIRMED',
        anchorId: 'anchor-1',
        verifiedAt: new Date().toISOString(),
      };

      service.verifyHash.mockResolvedValue(expectedResult);

      const result = await controller.verifyHash(mockUser, tokenId);

      expect(service.verifyHash).toHaveBeenCalledWith(mockUser.companyId, tokenId);
      expect(result).toEqual(expectedResult);
    });
  });
});
