import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { InMemoryPrisma } from '../testing/in-memory-prisma';
import { AvailabilityChangeType } from '../interfaces/availability.interface';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      credit: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      creditReservation: { aggregate: jest.fn() },
      creditAvailabilityLog: { create: jest.fn() },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AvailabilityService);
  });

  it('decrements availability successfully', async () => {
    prisma.credit.findFirst
      .mockResolvedValueOnce({
        id: 'c1',
        projectName: 'Forest',
        availableAmount: 100,
        status: 'available',
      })
      .mockResolvedValueOnce({
        id: 'c1',
        availableAmount: 90,
        status: 'available',
      });
    prisma.credit.updateMany.mockResolvedValueOnce({ count: 1 });

    const res = await service.decrementAvailability('c1', 10, 'u1', 'purchase');

    expect(prisma.credit.updateMany).toHaveBeenCalled();
    expect(prisma.creditAvailabilityLog.create).toHaveBeenCalled();
    expect(res.availableAmount).toBe(90);
  });

  it('writes the decrement behind an availableAmount floor guard', async () => {
    prisma.credit.findFirst
      .mockResolvedValueOnce({
        id: 'c1',
        projectName: 'Forest',
        availableAmount: 100,
        status: 'available',
      })
      .mockResolvedValueOnce({ id: 'c1', availableAmount: 90 });
    prisma.credit.updateMany.mockResolvedValueOnce({ count: 1 });

    await service.decrementAvailability('c1', 10);

    expect(prisma.credit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'c1',
          availableAmount: { gte: 10 },
        }),
      }),
    );
  });

  it('throws when the guarded update matches no rows', async () => {
    prisma.credit.findFirst.mockResolvedValueOnce({
      id: 'c1',
      projectName: 'Forest',
      availableAmount: 100,
      status: 'available',
    });
    // Someone else consumed the units between the read and the write.
    prisma.credit.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.decrementAvailability('c1', 10)).rejects.toThrow(
      ConflictException,
    );
  });

  it('throws on insufficient availability', async () => {
    prisma.credit.findFirst.mockResolvedValueOnce({
      id: 'c1',
      projectName: 'Forest',
      availableAmount: 5,
      status: 'available',
    });
    await expect(service.decrementAvailability('c1', 10)).rejects.toThrow();
    expect(prisma.credit.updateMany).not.toHaveBeenCalled();
  });

  it('honors company scoping and throws when credit not found for tenant', async () => {
    prisma.credit.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.decrementAvailability('c1', 10, 'u1', 'purchase', 'otherCompany'),
    ).rejects.toThrow();
    expect(prisma.credit.findFirst).toHaveBeenCalledWith({
      where: { id: 'c1', companyId: 'otherCompany' },
    });
  });

  it('requests Serializable isolation for standalone decrements', async () => {
    prisma.credit.findFirst
      .mockResolvedValueOnce({
        id: 'c1',
        projectName: 'Forest',
        availableAmount: 100,
        status: 'available',
      })
      .mockResolvedValueOnce({ id: 'c1', availableAmount: 90 });
    prisma.credit.updateMany.mockResolvedValueOnce({ count: 1 });

    await service.decrementAvailability('c1', 10);

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
  });
});

// ── Lock-safe behaviour against a store that models FOR UPDATE (#516) ───────

describe('AvailabilityService – concurrency', () => {
  let service: AvailabilityService;
  let store: InMemoryPrisma;

  async function build(credits: any[], reservations: any[] = []) {
    store = new InMemoryPrisma(credits, reservations);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: store },
      ],
    }).compile();
    service = module.get(AvailabilityService);
  }

  const credit = (availableAmount: number) => ({
    id: 'credit-1',
    projectName: 'Amazon Rainforest',
    availableAmount,
    status: 'available',
  });

  it('serialises concurrent claims so the same units cannot be sold twice', async () => {
    await build([credit(100)]);

    const results = await Promise.allSettled([
      service.decrementAvailability('credit-1', 60, 'buyer-a', 'order-a'),
      service.decrementAvailability('credit-1', 60, 'buyer-b', 'order-b'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(store.credits.get('credit-1')!.availableAmount).toBe(40);
  });

  it('allows concurrent claims that together fit within availability', async () => {
    await build([credit(100)]);

    await Promise.all([
      service.decrementAvailability('credit-1', 40, 'buyer-a'),
      service.decrementAvailability('credit-1', 60, 'buyer-b'),
    ]);

    expect(store.credits.get('credit-1')!.availableAmount).toBe(0);
  });

  it('never drives availableAmount negative under heavy contention', async () => {
    await build([credit(50)]);

    await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        service.decrementAvailability('credit-1', 7, `buyer-${i}`),
      ),
    );

    const remaining = store.credits.get('credit-1')!.availableAmount;
    expect(remaining).toBeGreaterThanOrEqual(0);
    // 7 claims of 7 units fit in 50; the 8th must be rejected.
    expect(remaining).toBe(1);
  });

  it('leaves no availability log entry for a rejected claim', async () => {
    await build([credit(10)]);

    await expect(
      service.decrementAvailability('credit-1', 25, 'buyer-a'),
    ).rejects.toThrow(ConflictException);

    expect(store.availabilityLogs).toHaveLength(0);
    expect(store.credits.get('credit-1')!.availableAmount).toBe(10);
  });

  it('records every movement on CreditAvailabilityLog with its change type', async () => {
    await build([credit(100)]);

    await service.decrementAvailability(
      'credit-1',
      10,
      'user-1',
      'retire',
      undefined,
      {
        changeType: AvailabilityChangeType.RETIRE,
      },
    );

    expect(store.availabilityLogs).toEqual([
      expect.objectContaining({
        creditId: 'credit-1',
        changedBy: 'user-1',
        changeType: AvailabilityChangeType.RETIRE,
        amount: 10,
        previousAmount: 100,
        newAmount: 90,
      }),
    ]);
  });

  it('treats units held by an active cart reservation as unavailable', async () => {
    await build([credit(100)], [
      {
        cartId: 'cart-1',
        creditId: 'credit-1',
        quantity: 80,
        expiresAt: new Date(Date.now() + 60_000),
      },
    ] as any);

    await expect(
      service.decrementAvailability(
        'credit-1',
        30,
        'retirer',
        'retirement',
        undefined,
        { respectReservations: true },
      ),
    ).rejects.toThrow(ConflictException);

    // 20 units are genuinely free and can still be claimed.
    await expect(
      service.decrementAvailability(
        'credit-1',
        20,
        'retirer',
        'retirement',
        undefined,
        { respectReservations: true },
      ),
    ).resolves.toBeDefined();
  });

  it('ignores expired reservations when computing headroom', async () => {
    await build([credit(100)], [
      {
        cartId: 'cart-stale',
        creditId: 'credit-1',
        quantity: 90,
        expiresAt: new Date(Date.now() - 60_000),
      },
    ] as any);

    await expect(
      service.decrementAvailability(
        'credit-1',
        95,
        'retirer',
        'retirement',
        undefined,
        { respectReservations: true },
      ),
    ).resolves.toBeDefined();
  });

  it("excludes a cart's own reservation from its headroom", async () => {
    await build([credit(100)], [
      {
        cartId: 'cart-1',
        creditId: 'credit-1',
        quantity: 100,
        expiresAt: new Date(Date.now() + 60_000),
      },
    ] as any);

    await expect(
      service.decrementAvailability(
        'credit-1',
        100,
        'cart-1',
        'checkout',
        undefined,
        { respectReservations: true, reservationCartId: 'cart-1' },
      ),
    ).resolves.toBeDefined();
  });
});
