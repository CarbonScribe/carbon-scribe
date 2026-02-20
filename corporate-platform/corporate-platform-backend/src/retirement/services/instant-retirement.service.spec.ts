import { Test, TestingModule } from '@nestjs/testing';
import { InstantRetirementService } from './instant-retirement.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { ValidationService } from './validation.service';

describe('InstantRetirementService', () => {
  let service: InstantRetirementService;
  let prisma: PrismaService;
  let validationService: ValidationService;

  const mockPrisma = {
    $transaction: jest.fn((cb) => cb(mockPrisma)),
    credit: {
      update: jest.fn(),
    },
    retirement: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockValidationService = {
    validateRetirement: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstantRetirementService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ValidationService, useValue: mockValidationService },
      ],
    }).compile();

    service = module.get<InstantRetirementService>(InstantRetirementService);
    prisma = module.get<PrismaService>(PrismaService);
    validationService = module.get<ValidationService>(ValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should orchestrate retirement correctly', async () => {
    const dto = { creditId: 'cred1', amount: 10, purpose: 'scope1' };
    mockValidationService.validateRetirement.mockResolvedValue({ valid: true });
    mockPrisma.credit.update.mockResolvedValue({});
    mockPrisma.retirement.create.mockResolvedValue({ id: 'ret1' });
    mockPrisma.retirement.update.mockResolvedValue({
      id: 'ret1',
      certificateId: 'RET-2024-RET1',
    });

    const result = await service.retire('comp1', 'user1', dto as any);

    expect(validationService.validateRetirement).toHaveBeenCalled();
    expect(prisma.credit.update).toHaveBeenCalled();
    expect(prisma.retirement.create).toHaveBeenCalled();
    expect(result.certificateId).toBeDefined();
  });
});
