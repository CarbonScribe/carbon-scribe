import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { InstantRetirementService } from './instant-retirement.service';
import { ValidationService } from './validation.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { AvailabilityService } from '../../credit/services/availability.service';
import { InMemoryPrisma } from '../../credit/testing/in-memory-prisma';
import { AvailabilityChangeType } from '../../credit/interfaces/availability.interface';

describe('InstantRetirementService', () => {
  let service: InstantRetirementService;
  let store: InMemoryPrisma;

  const CREDIT = {
    id: 'cred1',
    projectName: 'Amazon Rainforest',
    availableAmount: 100,
    status: 'available',
  };

  async function build(
    credits = [CREDIT],
    reservations: any[] = [],
  ): Promise<void> {
    store = new InMemoryPrisma(credits, reservations);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstantRetirementService,
        ValidationService,
        AvailabilityService,
        { provide: PrismaService, useValue: store },
      ],
    }).compile();

    service = module.get(InstantRetirementService);
  }

  beforeEach(async () => {
    await build();
  });

  const dto = (overrides: Record<string, unknown> = {}) =>
    ({ creditId: 'cred1', amount: 10, purpose: 'scope1', ...overrides }) as any;

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should orchestrate retirement correctly', async () => {
    const result = await service.retire('comp1', 'user1', dto());

    expect(result.certificateId).toBeDefined();
    expect(store.retirements).toHaveLength(1);
    expect(store.retirements[0]).toEqual(
      expect.objectContaining({
        companyId: 'comp1',
        userId: 'user1',
        creditId: 'cred1',
        amount: 10,
      }),
    );
  });

  /**
   * Regression for the field-name bug (#516): the decrement used to be written
   * as `{ available: { decrement } }`, but the Prisma Credit model's field is
   * `availableAmount`. The update threw at runtime, so retiring credits never
   * actually reduced availability.
   */
  it('decrements Credit.availableAmount by the retired quantity', async () => {
    expect(store.credits.get('cred1')!.availableAmount).toBe(100);

    await service.retire('comp1', 'user1', dto({ amount: 25 }));

    expect(store.credits.get('cred1')!.availableAmount).toBe(75);
  });

  it('never writes to a non-existent `available` field', async () => {
    await service.retire('comp1', 'user1', dto());

    expect(store.credits.get('cred1')).not.toHaveProperty('available');
  });

  it('logs the retirement movement to CreditAvailabilityLog', async () => {
    await service.retire('comp1', 'user1', dto({ amount: 30 }));

    expect(store.availabilityLogs).toEqual([
      expect.objectContaining({
        creditId: 'cred1',
        changedBy: 'user1',
        changeType: AvailabilityChangeType.RETIRE,
        amount: 30,
        previousAmount: 100,
        newAmount: 70,
      }),
    ]);
  });

  it('rejects retiring more than is available and leaves inventory untouched', async () => {
    await expect(
      service.retire('comp1', 'user1', dto({ amount: 500 })),
    ).rejects.toThrow();

    expect(store.credits.get('cred1')!.availableAmount).toBe(100);
    expect(store.retirements).toHaveLength(0);
  });

  it('requests Serializable isolation for the retirement transaction', async () => {
    await service.retire('comp1', 'user1', dto());

    expect(store.isolationLevels).toContain('Serializable');
  });

  it('cannot consume units already held by an active cart reservation', async () => {
    await build(
      [{ ...CREDIT, availableAmount: 100 }],
      [
        {
          cartId: 'cart-1',
          creditId: 'cred1',
          quantity: 95,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
    );

    await expect(
      service.retire('comp1', 'user1', dto({ amount: 20 })),
    ).rejects.toThrow();

    expect(store.credits.get('cred1')!.availableAmount).toBe(100);
  });

  it('serialises concurrent retirements against the same credit', async () => {
    await build([{ ...CREDIT, availableAmount: 100 }]);

    const results = await Promise.allSettled([
      service.retire('comp1', 'user-a', dto({ amount: 70 })),
      service.retire('comp1', 'user-b', dto({ amount: 70 })),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(store.credits.get('cred1')!.availableAmount).toBe(30);
    expect(store.retirements).toHaveLength(1);
  });

  it('surfaces a ConflictException rather than overselling', async () => {
    await build([{ ...CREDIT, availableAmount: 10 }]);

    const [, second] = await Promise.allSettled([
      service.retire('comp1', 'user-a', dto({ amount: 10 })),
      service.retire('comp1', 'user-b', dto({ amount: 10 })),
    ]);

    expect(second.status).toBe('rejected');
    expect((second as PromiseRejectedResult).reason).toBeInstanceOf(
      ConflictException,
    );
  });
});
