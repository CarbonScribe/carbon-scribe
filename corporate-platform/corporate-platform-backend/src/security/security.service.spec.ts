import { Test, TestingModule } from '@nestjs/testing';
import { SecurityService } from './security.service';
import { PrismaService } from '../shared/database/prisma.service';
import {
  SecurityEvents,
  SecuritySeverity,
} from './constants/security-events.constants';

describe('SecurityService', () => {
  let service: SecurityService;
  let prisma: {
    ipWhitelist: {
      findMany: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
      findUnique: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
      deleteMany: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      ipWhitelist: {
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<SecurityService>(SecurityService);
  });

  describe('isIpAllowed', () => {
    it('returns true when no whitelist entries exist', async () => {
      prisma.ipWhitelist.findMany.mockResolvedValue([]);

      const result = await service.isIpAllowed('company-1', '1.2.3.4');

      expect(prisma.ipWhitelist.findMany).toHaveBeenCalledWith({
        where: { companyId: 'company-1', isActive: true },
      });
      expect(result).toBe(true);
    });

    it('returns true when ip is in one of the CIDR ranges', async () => {
      prisma.ipWhitelist.findMany.mockResolvedValue([{ cidr: '1.2.3.0/24' }]);

      const result = await service.isIpAllowed('company-1', '1.2.3.42');

      expect(result).toBe(true);
    });

    it('returns false when ip is not in any CIDR range', async () => {
      prisma.ipWhitelist.findMany.mockResolvedValue([{ cidr: '10.0.0.0/24' }]);

      const result = await service.isIpAllowed('company-1', '1.2.3.4');

      expect(result).toBe(false);
    });
  });

  describe('addWhitelist', () => {
    it('creates whitelist entry and logs event', async () => {
      prisma.ipWhitelist.create.mockResolvedValue({
        id: 'wh-1',
        companyId: 'company-1',
        cidr: '1.2.3.0/24',
      });
      prisma.auditLog.create.mockResolvedValue({});
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.addWhitelist(
        'company-1',
        'user-1',
        '1.2.3.0/24',
        'office',
      );

      expect(prisma.ipWhitelist.create).toHaveBeenCalledWith({
        data: {
          companyId: 'company-1',
          cidr: '1.2.3.0/24',
          description: 'office',
          createdBy: 'user-1',
        },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: SecurityEvents.IpWhitelistAdded,
            companyId: 'company-1',
            userId: 'user-1',
            status: 'success',
            severity: SecuritySeverity.Warning,
          }),
        }),
      );

      expect(result).toEqual(
        expect.objectContaining({
          id: 'wh-1',
        }),
      );
    });
  });

  describe('logEvent', () => {
    it('writes audit log with mapped severity and enforces retention', async () => {
      prisma.auditLog.create.mockResolvedValue({});
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });

      await service.logEvent({
        eventType: SecurityEvents.AuthLoginFailed,
        companyId: 'company-1',
        userId: 'user-1',
        status: 'failure',
        statusCode: 401,
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: SecurityEvents.AuthLoginFailed,
            companyId: 'company-1',
            userId: 'user-1',
            status: 'failure',
            statusCode: 401,
            severity: SecuritySeverity.Critical,
          }),
        }),
      );

      expect(prisma.auditLog.deleteMany).toHaveBeenCalled();
    });
  });
});
