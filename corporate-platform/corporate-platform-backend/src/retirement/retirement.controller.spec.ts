import { Test, TestingModule } from '@nestjs/testing';
import { RetirementController } from './retirement.controller';
import { InstantRetirementService } from './services/instant-retirement.service';
import { HistoryService } from './services/history.service';
import { ValidationService } from './services/validation.service';
import { CertificateService } from './services/certificate.service';
import { PrismaService } from '../shared/database/prisma.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RbacService } from '../rbac/rbac.service';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Reflector } from '@nestjs/core';
import { IpWhitelistGuard } from '../security/guards/ip-whitelist.guard';
import { SecurityService } from '../security/security.service';

describe('RetirementController', () => {
  let controller: RetirementController;

  const mockUser: JwtPayload = {
    sub: 'user-id',
    email: 'user@example.com',
    companyId: 'company-id',
    role: 'viewer',
    sessionId: 'session-id',
  };

  const mockInstantRetirementService = { retire: jest.fn() };
  const mockHistoryService = { getHistory: jest.fn(), getStats: jest.fn() };
  const mockValidationService = { validateRetirement: jest.fn() };
  const mockCertificateService = { generateCertificate: jest.fn() };
  const mockPrisma = { retirement: { findUnique: jest.fn() } };
  const mockRbacService = {
    hasAllPermissions: jest.fn().mockResolvedValue(true),
    getUserPermissions: jest.fn().mockResolvedValue([]),
  };
  const mockSecurityService = {
    isIpAllowed: jest.fn().mockResolvedValue(true),
    logEvent: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RetirementController],
      providers: [
        {
          provide: InstantRetirementService,
          useValue: mockInstantRetirementService,
        },
        { provide: HistoryService, useValue: mockHistoryService },
        { provide: ValidationService, useValue: mockValidationService },
        { provide: CertificateService, useValue: mockCertificateService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RbacService, useValue: mockRbacService },
        { provide: SecurityService, useValue: mockSecurityService },
        Reflector,
        PermissionsGuard,
        IpWhitelistGuard,
      ],
    }).compile();

    controller = module.get<RetirementController>(RetirementController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call retire service', async () => {
    const dto = { creditId: 'cred1', amount: 10, purpose: 'scope1' };
    await controller.retireCredits(mockUser, dto as any);
    expect(mockInstantRetirementService.retire).toHaveBeenCalled();
  });

  it('should return history', async () => {
    await controller.getHistory(mockUser, {} as any);
    expect(mockHistoryService.getHistory).toHaveBeenCalled();
  });
});
