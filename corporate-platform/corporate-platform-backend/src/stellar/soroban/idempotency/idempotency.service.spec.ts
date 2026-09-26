import { Test, TestingModule } from '@nestjs/testing';
import { IdempotencyService } from './idempotency.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import {
  ContractCallStatus,
  DuplicateStrategy,
} from '../interfaces/idempotency.interface';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  // let prisma: PrismaService;

  const mockPrismaService = {
    contractCall: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
    // prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateDeduplicationKey', () => {
    it('should generate consistent keys for same inputs', () => {
      const components = {
        workflowId: 'test-123',
        methodName: 'retire',
        argsHash: 'abc123',
      };

      const key1 = service.generateDeduplicationKey(components);
      const key2 = service.generateDeduplicationKey(components);

      expect(key1).toBe(key2);
    });
  });

  describe('hashArguments', () => {
    it('should produce consistent hashes for same arguments', () => {
      const args1 = [1, 'test', { a: 1, b: 2 }];
      const args2 = [1, 'test', { b: 2, a: 1 }];

      const hash1 = service.hashArguments(args1);
      const hash2 = service.hashArguments(args2);

      expect(hash1).toBe(hash2);
    });
  });

  describe('checkAndHandleDuplicate', () => {
    it('should detect duplicate calls', async () => {
      const existingCall = {
        id: 'call-123',
        status: ContractCallStatus.CONFIRMED,
        transactionHash: 'tx-123',
        result: { success: true },
      };

      mockPrismaService.contractCall.findUnique.mockResolvedValue(existingCall);

      const result = await service.checkAndHandleDuplicate(
        'company-123',
        'contract-123',
        'retire',
        [1, 100],
        { workflowId: 'test-123' },
        DuplicateStrategy.RETURN_CACHED,
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.existingCall).toBe(existingCall);
      expect(result.shouldProceed).toBe(false);
    });
  });
});
