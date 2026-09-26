import { Test, TestingModule } from '@nestjs/testing';
import { ValidationService } from './validation.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { AvailabilityService } from '../../credit/services/availability.service';
import { InMemoryPrisma } from '../../credit/testing/in-memory-prisma';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

describe('ValidationService', () => {
  let service: ValidationService;

  const mockPrisma = {
    credit: {
      findUnique: jest.fn(),
    },
    creditReservation: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: null } }),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.creditReservation.aggregate.mockResolvedValue({
      _sum: { quantity: null },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationService,
        AvailabilityService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ValidationService>(ValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw NotFoundException if credit not found', async () => {
    mockPrisma.credit.findUnique.mockResolvedValue(null);
    await expect(
      service.validateRetirement('comp1', 'cred1', 10),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if insufficient balance', async () => {
    mockPrisma.credit.findUnique.mockResolvedValue({
      id: 'cred1',
      availableAmount: 5,
    });
    await expect(
      service.validateRetirement('comp1', 'cred1', 10),
    ).rejects.toThrow(BadRequestException);
  });

  it('should return valid if balance is sufficient', async () => {
    mockPrisma.credit.findUnique.mockResolvedValue({
      id: 'cred1',
      availableAmount: 20,
    });
    const result = await service.validateRetirement('comp1', 'cred1', 10);
    expect(result.valid).toBe(true);
  });

  it('subtracts active cart reservations from the advisory availability', async () => {
    mockPrisma.credit.findUnique.mockResolvedValue({
      id: 'cred1',
      availableAmount: 20,
    });
    mockPrisma.creditReservation.aggregate.mockResolvedValue({
      _sum: { quantity: 15 },
    });

    await expect(
      service.validateRetirement('comp1', 'cred1', 10),
    ).rejects.toThrow(BadRequestException);

    const result = await service.validateRetirement('comp1', 'cred1', 5);
    expect(result.available).toBe(5);
    expect(result.reserved).toBe(15);
    expect(result.rawAvailable).toBe(20);
  });
});

// ── Transactional check (#516) ─────────────────────────────────────────────

describe('ValidationService – validateRetirementWithin', () => {
  let service: ValidationService;
  let availability: AvailabilityService;
  let store: InMemoryPrisma;

  beforeEach(async () => {
    store = new InMemoryPrisma([
      {
        id: 'cred1',
        projectName: 'Amazon Rainforest',
        availableAmount: 50,
        status: 'available',
      },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationService,
        AvailabilityService,
        { provide: PrismaService, useValue: store },
      ],
    }).compile();

    service = module.get(ValidationService);
    availability = module.get(AvailabilityService);
  });

  it('validates inside the caller transaction and reports headroom', async () => {
    const result = await availability.runSerializable((tx) =>
      service.validateRetirementWithin(tx as any, 'comp1', 'cred1', 20),
    );

    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        available: 50,
        rawAvailable: 50,
        reserved: 0,
      }),
    );
  });

  it('rejects a claim that exceeds effective availability', async () => {
    await expect(
      availability.runSerializable((tx) =>
        service.validateRetirementWithin(tx as any, 'comp1', 'cred1', 80),
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('takes the credit row lock so the check and the write cannot interleave', async () => {
    // Two transactions validating the same credit must not overlap: the second
    // only observes state after the first has committed its decrement.
    const observed: number[] = [];

    await Promise.all([
      availability.runSerializable(async (tx) => {
        const headroom = await service.validateRetirementWithin(
          tx as any,
          'comp1',
          'cred1',
          30,
        );
        observed.push(headroom.rawAvailable);
        await availability.decrementWithin(tx as any, {
          creditId: 'cred1',
          amount: 30,
        });
      }),
      availability.runSerializable(async (tx) => {
        const headroom = await service.validateRetirementWithin(
          tx as any,
          'comp1',
          'cred1',
          10,
        );
        observed.push(headroom.rawAvailable);
      }),
    ]);

    // One transaction saw 50; the other saw 20 — never 50 twice, which is what
    // the old non-transactional pre-check allowed.
    expect(observed.sort((a, b) => a - b)).toEqual([20, 50]);
  });
});
