import { Test, TestingModule } from '@nestjs/testing';
import { SecurityService } from './security.service';
import { PrismaService } from '../shared/database/prisma.service';
import { SecurityEvents } from './constants/security-events.constants';

describe('SecurityService', () => {
  let service: SecurityService;
  let prisma: {
    ipWhitelist: {
      findMany: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
      deleteMany: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      ipWhitelist: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: '1' }),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('allows IP when no whitelist entries exist', async () => {
    const allowed = await service.isIpAllowed('company-1', '127.0.0.1');
    expect(allowed).toBe(true);
    expect(prisma.ipWhitelist.findMany).toHaveBeenCalled();
  });

  it('logs audit event', async () => {
    await service.logEvent({
      eventType: SecurityEvents.AuditLog,
      companyId: 'company-1',
      userId: 'user-1',
      resource: '/test',
      method: 'GET',
    });

    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});

