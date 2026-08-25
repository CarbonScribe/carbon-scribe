import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { AvailabilityService } from '../../credit/services/availability.service';
import { InMemoryPrisma } from '../../credit/testing/in-memory-prisma';
import { AvailabilityChangeType } from '../../credit/interfaces/availability.interface';

describe('ReservationService', () => {
  let service: ReservationService;
  let store: InMemoryPrisma;

  async function build(credits: any[], reservations: any[] = []) {
    store = new InMemoryPrisma(credits, reservations);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationService,
        AvailabilityService,
        { provide: PrismaService, useValue: store },
      ],
    }).compile();

    service = module.get(ReservationService);
  }

  const credit = (availableAmount: number, id = 'credit-1') => ({
    id,
    projectName: 'Amazon Rainforest',
    availableAmount,
    status: 'available',
  });

  beforeEach(async () => {
    await build([credit(100)]);
  });

  it('reserves credits for a cart', async () => {
    await service.reserveCredits('cart-1', [
      { creditId: 'credit-1', quantity: 40 },
    ]);

    expect(store.reservations).toEqual([
      expect.objectContaining({
        cartId: 'cart-1',
        creditId: 'credit-1',
        quantity: 40,
      }),
    ]);
  });

  it('does not decrement availableAmount — a reservation is a hold', async () => {
    await service.reserveCredits('cart-1', [
      { creditId: 'credit-1', quantity: 40 },
    ]);

    expect(store.credits.get('credit-1')!.availableAmount).toBe(100);
  });

  it('records the hold on CreditAvailabilityLog', async () => {
    await service.reserveCredits('cart-1', [
      { creditId: 'credit-1', quantity: 40 },
    ]);

    expect(store.availabilityLogs).toEqual([
      expect.objectContaining({
        creditId: 'credit-1',
        changedBy: 'cart:cart-1',
        changeType: AvailabilityChangeType.RESERVE,
        amount: 40,
        previousAmount: 100,
        newAmount: 100,
      }),
    ]);
  });

  it('rejects a reservation that exceeds effective availability', async () => {
    await expect(
      service.reserveCredits('cart-1', [
        { creditId: 'credit-1', quantity: 500 },
      ]),
    ).rejects.toThrow(ConflictException);

    expect(store.reservations).toHaveLength(0);
  });

  it('counts other carts’ active holds against availability', async () => {
    await build(
      [credit(100)],
      [
        {
          cartId: 'cart-other',
          creditId: 'credit-1',
          quantity: 80,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
    );

    await expect(
      service.reserveCredits('cart-1', [{ creditId: 'credit-1', quantity: 30 }]),
    ).rejects.toThrow(ConflictException);
  });

  it("does not count a cart's own hold against itself when re-reserving", async () => {
    await build(
      [credit(100)],
      [
        {
          cartId: 'cart-1',
          creditId: 'credit-1',
          quantity: 100,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
    );

    await expect(
      service.reserveCredits('cart-1', [{ creditId: 'credit-1', quantity: 90 }]),
    ).resolves.toBeUndefined();

    expect(store.reservations[0].quantity).toBe(90);
  });

  it('requests Serializable isolation', async () => {
    await service.reserveCredits('cart-1', [
      { creditId: 'credit-1', quantity: 10 },
    ]);

    expect(store.isolationLevels).toContain('Serializable');
  });

  /**
   * The original implementation read availability and the reservation
   * aggregate, then upserted — all without a row lock. Under READ COMMITTED,
   * two carts could both observe the same pre-reservation state and both
   * succeed, oversubscribing the credit (#516).
   */
  it('does not let two concurrent carts oversubscribe the same credit', async () => {
    await build([credit(100)]);

    const results = await Promise.allSettled([
      service.reserveCredits('cart-a', [
        { creditId: 'credit-1', quantity: 60 },
      ]),
      service.reserveCredits('cart-b', [
        { creditId: 'credit-1', quantity: 60 },
      ]),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);

    const totalHeld = store.reservations.reduce((sum, r) => sum + r.quantity, 0);
    expect(totalHeld).toBeLessThanOrEqual(100);
    expect(totalHeld).toBe(60);
  });

  it('allows concurrent carts whose holds fit together', async () => {
    await build([credit(100)]);

    await Promise.all([
      service.reserveCredits('cart-a', [
        { creditId: 'credit-1', quantity: 40 },
      ]),
      service.reserveCredits('cart-b', [
        { creditId: 'credit-1', quantity: 60 },
      ]),
    ]);

    expect(
      store.reservations.reduce((sum, r) => sum + r.quantity, 0),
    ).toBe(100);
  });

  it('releases a cart’s reservations and logs the release', async () => {
    await service.reserveCredits('cart-1', [
      { creditId: 'credit-1', quantity: 40 },
    ]);

    await service.releaseReservations('cart-1');

    expect(store.reservations).toHaveLength(0);
    expect(store.availabilityLogs).toContainEqual(
      expect.objectContaining({
        changeType: AvailabilityChangeType.RELEASE,
        amount: 40,
      }),
    );
  });

  it('sweeps expired reservations and logs them', async () => {
    await build(
      [credit(100)],
      [
        {
          cartId: 'cart-stale',
          creditId: 'credit-1',
          quantity: 25,
          expiresAt: new Date(Date.now() - 60_000),
        },
        {
          cartId: 'cart-live',
          creditId: 'credit-1',
          quantity: 10,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
    );

    await service.releaseExpiredReservations();

    expect(store.reservations.map((r) => r.cartId)).toEqual(['cart-live']);
    expect(store.availabilityLogs).toContainEqual(
      expect.objectContaining({
        changeType: AvailabilityChangeType.RELEASE,
        amount: 25,
        changedBy: 'system',
      }),
    );
  });
});
