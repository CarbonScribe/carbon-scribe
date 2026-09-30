import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutService } from './checkout.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { PaymentService } from './payment.service';
import { ReservationService } from './reservation.service';
import { AuditService } from './audit.service';
import { UnitOfWorkService } from '../../shared/database/unit-of-work.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PostPurchaseService } from '../../retirement/services/post-purchase.service';
import { AvailabilityService } from '../../credit/services/availability.service';
import { AvailabilityChangeType } from '../../credit/interfaces/availability.interface';
import { InMemoryPrisma } from '../../credit/testing/in-memory-prisma';
import { ProducerService } from '../../event-bus/producer.service';

describe('CheckoutService', () => {
  let service: CheckoutService;

  const mockPrisma = {
    $transaction: jest.fn((cb) => cb(mockPrisma)),
    cart: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    cartItem: {
      deleteMany: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    orderItem: {
      create: jest.fn(),
    },
    credit: {
      update: jest.fn(),
    },
    creditReservation: {
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockPaymentService = {
    processPayment: jest.fn(),
    refundPayment: jest
      .fn()
      .mockResolvedValue({ success: true, refundId: 'ref_1' }),
  };

  const mockUnitOfWork = {
    run: jest.fn((cb) => cb(mockPrisma)),
  };

  const mockReservationService = {
    reserveCredits: jest.fn().mockResolvedValue(undefined),
    releaseReservations: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditService = {
    logOrderEvent: jest.fn().mockResolvedValue(undefined),
  };

  const mockPostPurchaseService = {
    handleOrderCompleted: jest.fn().mockResolvedValue(undefined),
  };

  const mockAvailabilityService = {
    decrementWithin: jest.fn().mockResolvedValue({ newAmount: 0 }),
    runSerializable: jest.fn((cb) => cb(mockPrisma)),
    lockCredit: jest.fn().mockResolvedValue(true),
  };

  const mockProducerService = {
    publish: jest.fn().mockResolvedValue(undefined),
    publishPending: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UnitOfWorkService, useValue: mockUnitOfWork },
        { provide: PaymentService, useValue: mockPaymentService },
        { provide: ReservationService, useValue: mockReservationService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: PostPurchaseService, useValue: mockPostPurchaseService },
        { provide: AvailabilityService, useValue: mockAvailabilityService },
        { provide: ProducerService, useValue: mockProducerService },
      ],
    }).compile();

    service = module.get<CheckoutService>(CheckoutService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initiateCheckout', () => {
    it('should throw BadRequestException when cart is empty', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue(null);

      await expect(
        service.initiateCheckout('comp1', 'user1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when cart has no items', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue({
        id: 'cart1',
        items: [],
      });

      await expect(
        service.initiateCheckout('comp1', 'user1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when credits are insufficient', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue({
        id: 'cart1',
        items: [
          {
            creditId: 'cred1',
            quantity: 1000,
            price: 10,
            credit: { availableAmount: 500, projectName: 'Solar Farm' },
          },
        ],
      });

      await expect(
        service.initiateCheckout('comp1', 'user1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create order successfully', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue({
        id: 'cart1',
        items: [
          {
            creditId: 'cred1',
            quantity: 1000,
            price: 10,
            credit: { availableAmount: 5000, projectName: 'Solar Farm' },
          },
        ],
      });

      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.create.mockResolvedValue({
        id: 'order1',
        orderNumber: 'ORD-2026-0001',
        status: 'pending',
      });
      mockPrisma.orderItem.create.mockResolvedValue({});

      const result = await service.initiateCheckout('comp1', 'user1', {
        paymentMethod: 'credit_card',
      });

      expect(result.orderId).toBe('order1');
      expect(result.orderNumber).toBe('ORD-2026-0001');
      expect(result.status).toBe('pending');
    });
  });

  describe('confirmPurchase', () => {
    it('should throw NotFoundException when order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmPurchase('nonexistent', 'comp1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when order is not pending', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order1',
        companyId: 'comp1',
        status: 'completed',
        items: [],
      });

      await expect(service.confirmPurchase('order1', 'comp1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should complete purchase successfully', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order1',
        companyId: 'comp1',
        status: 'pending',
        paymentMethod: 'credit_card',
        total: 10500,
        cartId: 'cart1',
        items: [
          {
            creditId: 'cred1',
            quantity: 1000,
            price: 10,
            subtotal: 10000,
            credit: { availableAmount: 5000, projectName: 'Solar Farm' },
          },
        ],
      });

      mockPaymentService.processPayment.mockResolvedValue({
        paymentId: 'pay_123',
        status: 'approved',
        transactionHash: 'tx_abc',
      });

      mockPrisma.creditReservation.findFirst.mockResolvedValue({
        cartId: 'cart1',
        creditId: 'cred1',
        quantity: 1000,
        expiresAt: new Date(Date.now() + 60_000),
      });

      mockAvailabilityService.decrementWithin.mockResolvedValue({
        newAmount: 4000,
      });
      mockPrisma.order.update.mockResolvedValue({
        id: 'order1',
        orderNumber: 'ORD-2026-0001',
        companyId: 'comp1',
        userId: 'user1',
        status: 'completed',
        subtotal: 10000,
        serviceFee: 500,
        total: 10500,
        paymentId: 'pay_123',
        paymentMethod: 'credit_card',
        transactionHash: 'tx_abc',
        paidAt: new Date(),
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: null,
        items: [
          {
            id: 'oi1',
            creditId: 'cred1',
            quantity: 1000,
            price: 10,
            subtotal: 10000,
            credit: { projectName: 'Solar Farm' },
          },
        ],
      });
      mockPrisma.cartItem.deleteMany.mockResolvedValue({});
      mockPrisma.cart.update.mockResolvedValue({});

      const result = await service.confirmPurchase('order1', 'comp1');

      // The decrement goes through the shared lock-safe path rather than a
      // bare credit.update (#516).
      expect(mockAvailabilityService.decrementWithin).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          creditId: 'cred1',
          amount: 1000,
          changeType: AvailabilityChangeType.PURCHASE,
          reservationCartId: 'cart1',
          respectReservations: true,
        }),
      );
      expect(mockPrisma.credit.update).not.toHaveBeenCalled();

      expect(result.order.status).toBe('completed');
      expect(result.transactionHash).toBe('tx_abc');
      expect(mockPaymentService.processPayment).toHaveBeenCalled();
    });

    it('should fail order when payment is declined', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order1',
        companyId: 'comp1',
        status: 'pending',
        paymentMethod: 'credit_card',
        total: 10500,
        items: [
          {
            creditId: 'cred1',
            quantity: 1000,
            price: 10,
            credit: { availableAmount: 5000, projectName: 'Solar Farm' },
          },
        ],
      });

      mockPaymentService.processPayment.mockResolvedValue({
        paymentId: 'pay_123',
        status: 'declined',
      });

      mockPrisma.order.update.mockResolvedValue({});

      await expect(service.confirmPurchase('order1', 'comp1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

// ── Cross-flow inventory safety (#516) ─────────────────────────────────────

/**
 * Checkout confirmation and instant retirement compete for the same
 * `Credit.availableAmount`. These tests drive the real AvailabilityService
 * against a store that models `SELECT ... FOR UPDATE`, proving the two flows
 * serialise on one shared code path instead of each reinventing a decrement.
 */
describe('CheckoutService – shared inventory path', () => {
  let service: CheckoutService;
  let availability: AvailabilityService;
  let store: InMemoryPrisma;
  const producerService = {
    publish: jest.fn().mockResolvedValue(undefined),
    publishPending: jest.fn().mockResolvedValue(undefined),
  };

  const order = (quantity: number, cartId = 'cart1') => ({
    id: 'order1',
    companyId: 'comp1',
    userId: 'user1',
    status: 'pending',
    paymentMethod: 'credit_card',
    total: 100,
    cartId,
    items: [
      {
        id: 'oi1',
        creditId: 'credit-1',
        quantity,
        price: 10,
        subtotal: quantity * 10,
        credit: { availableAmount: 100, projectName: 'Amazon Rainforest' },
      },
    ],
  });

  beforeEach(async () => {
    store = new InMemoryPrisma(
      [
        {
          id: 'credit-1',
          projectName: 'Amazon Rainforest',
          availableAmount: 100,
          status: 'available',
        },
      ],
      [
        // The order's own active reservation — required since confirmPurchase
        // now verifies it is still live before decrementing (#545).
        {
          cartId: 'cart1',
          creditId: 'credit-1',
          quantity: 60,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
    );

    // Layer the order/cart models the fake does not implement onto the same
    // client so both the availability path and the checkout bookkeeping work,
    // inside transactions as well as outside them.
    const prisma: any = store;
    store.registerModel('order', {
      findUnique: jest.fn().mockResolvedValue(order(60)),
      update: jest.fn().mockImplementation(({ data }: any) => ({
        ...order(60),
        ...data,
        items: order(60).items,
      })),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    });
    store.registerModel('orderItem', { create: jest.fn() });
    store.registerModel('cart', { findFirst: jest.fn(), update: jest.fn() });
    store.registerModel('cartItem', { deleteMany: jest.fn() });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        AvailabilityService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: UnitOfWorkService,
          useValue: {
            run: (cb: any) =>
              (prisma as InMemoryPrisma).$transaction(cb, {
                isolationLevel: 'Serializable',
              }),
          },
        },
        {
          provide: PaymentService,
          useValue: {
            processPayment: jest.fn().mockResolvedValue({
              paymentId: 'pay_1',
              status: 'approved',
              transactionHash: 'tx_1',
            }),
            refundPayment: jest
              .fn()
              .mockResolvedValue({ success: true, refundId: 'ref_1' }),
          },
        },
        {
          provide: ReservationService,
          useValue: {
            reserveCredits: jest.fn(),
            releaseReservations: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: { logOrderEvent: jest.fn() },
        },
        {
          provide: PostPurchaseService,
          useValue: { handleOrderCompleted: jest.fn() },
        },
        {
          provide: ProducerService,
          useValue: producerService,
        },
      ],
    }).compile();

    service = module.get(CheckoutService);
    availability = module.get(AvailabilityService);
  });

  it('decrements availability through the shared path on confirmation', async () => {
    await service.confirmPurchase('order1', 'comp1');

    expect(store.credits.get('credit-1')!.availableAmount).toBe(40);
    expect(store.availabilityLogs).toContainEqual(
      expect.objectContaining({
        creditId: 'credit-1',
        changeType: AvailabilityChangeType.PURCHASE,
        amount: 60,
        previousAmount: 100,
        newAmount: 40,
      }),
    );
  });

  it('cannot oversell against a concurrent retirement of the same credit', async () => {
    const results = await Promise.allSettled([
      service.confirmPurchase('order1', 'comp1'),
      // Stand-in for the retirement flow: same shared decrement helper.
      availability.decrementAvailability(
        'credit-1',
        60,
        'retirer',
        'retirement',
        undefined,
        {
          changeType: AvailabilityChangeType.RETIRE,
          respectReservations: true,
        },
      ),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(store.credits.get('credit-1')!.availableAmount).toBe(40);
  });

  it('never drives availableAmount negative', async () => {
    await Promise.allSettled([
      service.confirmPurchase('order1', 'comp1'),
      availability.decrementAvailability('credit-1', 60, 'a'),
      availability.decrementAvailability('credit-1', 60, 'b'),
      availability.decrementAvailability('credit-1', 60, 'c'),
    ]);

    expect(
      store.credits.get('credit-1')!.availableAmount,
    ).toBeGreaterThanOrEqual(0);
  });
});

// ── Reservation expiry cannot cause a stale decrement (#545) ────────────────

describe('CheckoutService – reservation expiry guard', () => {
  let service: CheckoutService;
  let store: InMemoryPrisma;
  const releaseReservations = jest.fn().mockResolvedValue(undefined);
  const refundPayment = jest
    .fn()
    .mockResolvedValue({ success: true, refundId: 'ref_1' });

  const order = {
    id: 'order1',
    companyId: 'comp1',
    userId: 'user1',
    status: 'pending',
    paymentMethod: 'credit_card',
    total: 100,
    cartId: 'cart1',
    items: [
      {
        id: 'oi1',
        creditId: 'credit-1',
        quantity: 30,
        price: 10,
        subtotal: 300,
        credit: { availableAmount: 100, projectName: 'Amazon Rainforest' },
      },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // No reservation is seeded for cart1/credit-1 — modelling the reservation
    // having expired (and been swept by releaseExpiredReservations) between
    // initiateCheckout and confirmPurchase.
    store = new InMemoryPrisma([
      {
        id: 'credit-1',
        projectName: 'Amazon Rainforest',
        availableAmount: 100,
        status: 'available',
      },
    ]);

    const prisma: any = store;
    store.registerModel('order', {
      findUnique: jest.fn().mockResolvedValue(order),
      update: jest.fn().mockImplementation(({ data }: any) => ({
        ...order,
        ...data,
      })),
    });
    store.registerModel('cart', { findFirst: jest.fn(), update: jest.fn() });
    store.registerModel('cartItem', { deleteMany: jest.fn() });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        AvailabilityService,
        { provide: PrismaService, useValue: prisma },
        { provide: UnitOfWorkService, useValue: { run: jest.fn() } },
        {
          provide: PaymentService,
          useValue: {
            processPayment: jest.fn().mockResolvedValue({
              paymentId: 'pay_1',
              status: 'approved',
              transactionHash: 'tx_1',
            }),
            refundPayment,
          },
        },
        {
          provide: ReservationService,
          useValue: { reserveCredits: jest.fn(), releaseReservations },
        },
        { provide: AuditService, useValue: { logOrderEvent: jest.fn() } },
        {
          provide: PostPurchaseService,
          useValue: { handleOrderCompleted: jest.fn() },
        },
        {
          provide: ProducerService,
          useValue: {
            publish: jest.fn().mockResolvedValue(undefined),
            publishPending: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(CheckoutService);
  });

  it('rejects with BadRequestException, refunds, and releases the reservation when it has expired', async () => {
    await expect(service.confirmPurchase('order1', 'comp1')).rejects.toThrow(
      BadRequestException,
    );

    // The floor-guarded decrement never ran — availableAmount is untouched.
    expect(store.credits.get('credit-1')!.availableAmount).toBe(100);
    expect(refundPayment).toHaveBeenCalledWith('pay_1');
    expect(releaseReservations).toHaveBeenCalledWith('cart1');
  });
});

// ── Concurrency load test: many confirmPurchase calls, one scarce credit (#545) ─

/**
 * Fires several simultaneous confirmPurchase calls, each for a distinct order,
 * against one credit with limited availableAmount, and asserts the total ever
 * decremented cannot exceed what was available — the core guarantee #545
 * requires. Orders here are cart-less (Order.cartId is nullable in the
 * schema — e.g. an administrative or direct order) specifically to isolate
 * the floor-guard/row-lock race on raw availableAmount from cart-reservation
 * admission control, which is already covered separately in
 * reservation.service.spec.ts.
 */
describe('CheckoutService – concurrent confirmPurchase load test', () => {
  let service: CheckoutService;
  let store: InMemoryPrisma;

  const ORDER_COUNT = 5;
  const CLAIM_PER_ORDER = 30;
  const INITIAL_AVAILABLE = 100;

  const makeOrder = (index: number) => ({
    id: `order-${index}`,
    companyId: 'comp1',
    userId: `user-${index}`,
    status: 'pending',
    paymentMethod: 'credit_card',
    total: 300,
    cartId: null,
    items: [
      {
        id: `oi-${index}`,
        creditId: 'credit-1',
        quantity: CLAIM_PER_ORDER,
        price: 10,
        subtotal: CLAIM_PER_ORDER * 10,
        credit: {
          availableAmount: INITIAL_AVAILABLE,
          projectName: 'Amazon Rainforest',
        },
      },
    ],
  });

  beforeEach(async () => {
    const orders = new Map(
      Array.from({ length: ORDER_COUNT }, (_, i) => [
        `order-${i}`,
        makeOrder(i),
      ]),
    );

    store = new InMemoryPrisma([
      {
        id: 'credit-1',
        projectName: 'Amazon Rainforest',
        availableAmount: INITIAL_AVAILABLE,
        status: 'available',
      },
    ]);

    const prisma: any = store;
    store.registerModel('order', {
      findUnique: jest.fn(({ where }: any) => orders.get(where.id) ?? null),
      update: jest.fn(({ where, data }: any) => {
        const current = orders.get(where.id);
        const updated = { ...current, ...data };
        orders.set(where.id, updated);
        return updated;
      }),
    });
    store.registerModel('cart', { findFirst: jest.fn(), update: jest.fn() });
    store.registerModel('cartItem', { deleteMany: jest.fn() });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        AvailabilityService,
        { provide: PrismaService, useValue: prisma },
        { provide: UnitOfWorkService, useValue: { run: jest.fn() } },
        {
          provide: PaymentService,
          useValue: {
            processPayment: jest.fn().mockResolvedValue({
              paymentId: 'pay_1',
              status: 'approved',
              transactionHash: 'tx_1',
            }),
            refundPayment: jest
              .fn()
              .mockResolvedValue({ success: true, refundId: 'ref_1' }),
          },
        },
        {
          provide: ReservationService,
          useValue: {
            reserveCredits: jest.fn(),
            releaseReservations: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: AuditService, useValue: { logOrderEvent: jest.fn() } },
        {
          provide: PostPurchaseService,
          useValue: { handleOrderCompleted: jest.fn() },
        },
        {
          provide: ProducerService,
          useValue: {
            publish: jest.fn().mockResolvedValue(undefined),
            publishPending: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(CheckoutService);
  });

  it('never lets simultaneous confirmPurchase calls together decrement more than was available', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: ORDER_COUNT }, (_, i) =>
        service.confirmPurchase(`order-${i}`, 'comp1'),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );

    // 100 available / 30 per order fits exactly 3 orders; the other 2 must
    // lose the race, whichever they happen to be.
    expect(fulfilled).toHaveLength(3);
    expect(rejected).toHaveLength(2);
    for (const failure of rejected) {
      expect(failure.reason).toBeInstanceOf(BadRequestException);
    }

    const remaining = store.credits.get('credit-1')!.availableAmount;
    expect(remaining).toBe(
      INITIAL_AVAILABLE - fulfilled.length * CLAIM_PER_ORDER,
    );
    expect(remaining).toBeGreaterThanOrEqual(0);

    // Total consumed can never exceed what was actually available.
    expect(fulfilled.length * CLAIM_PER_ORDER).toBeLessThanOrEqual(
      INITIAL_AVAILABLE,
    );
  });
});
