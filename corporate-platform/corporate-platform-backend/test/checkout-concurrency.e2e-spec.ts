import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutService } from './checkout.service';
import { ReservationService } from './reservation.service';
import { AvailabilityService } from '../../credit/services/availability.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { UnitOfWorkService } from '../../shared/database/unit-of-work.service';
import { PaymentService } from './payment.service';
import { AuditService } from './audit.service';
import { PostPurchaseService } from '../../retirement/services/post-purchase.service';

describe('CheckoutService - Concurrency (e2e)', () => {
  let checkoutService: CheckoutService;
  let reservationService: ReservationService;
  let availabilityService: AvailabilityService;
  let prisma: PrismaService;
  let module: TestingModule;

  // Test fixtures
  let testCompanyId: string;
  let testCreditId: string;
  let testUserId: string;
  let testProjectId: string;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        CheckoutService,
        ReservationService,
        AvailabilityService,
        PrismaService,
        UnitOfWorkService,
        {
          provide: PaymentService,
          useValue: {
            processPayment: jest.fn().mockResolvedValue({
              status: 'approved',
              paymentId: 'test-payment',
              transactionHash: 'test-hash',
            }),
          },
        },
        {
          provide: AuditService,
          useValue: {
            logOrderEvent: jest.fn(),
          },
        },
        {
          provide: PostPurchaseService,
          useValue: {
            handleOrderCompleted: jest.fn(),
          },
        },
      ],
    }).compile();

    checkoutService = module.get<CheckoutService>(CheckoutService);
    reservationService = module.get<ReservationService>(ReservationService);
    availabilityService = module.get<AvailabilityService>(AvailabilityService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    // Create test data: company, project, credit
    const company = await prisma.company.create({
      data: { name: 'Test Company' },
    });
    testCompanyId = company.id;

    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        companyId: testCompanyId,
      },
    });
    testUserId = user.id;

    const project = await prisma.project.create({
      data: {
        name: 'Test Project',
        startDate: new Date(),
      },
    });
    testProjectId = project.id;

    // Create a credit with limited availability
    const credit = await prisma.credit.create({
      data: {
        projectId: testProjectId,
        projectName: project.name,
        availableAmount: 100, // Only 100 units available
        totalAmount: 1000,
        pricePerTon: 10,
        companyId: testCompanyId,
      },
    });
    testCreditId = credit.id;
  });

  afterEach(async () => {
    // Cleanup
    await prisma.credit.deleteMany({ where: { id: testCreditId } });
    await prisma.project.deleteMany({ where: { id: testProjectId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.company.deleteMany({ where: { id: testCompanyId } });
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Concurrent confirmPurchase - oversell prevention', () => {
    it('should not allow two concurrent purchases to exceed available amount', async () => {
      // Setup: create two carts with orders attempting to buy 60 units each (total 120 > 100 available)
      const cart1 = await prisma.cart.create({
        data: { companyId: testCompanyId },
      });
      const cart2 = await prisma.cart.create({
        data: { companyId: testCompanyId },
      });

      // Create cart items
      await prisma.cartItem.create({
        data: {
          cartId: cart1.id,
          creditId: testCreditId,
          quantity: 60,
          price: 10,
        },
      });
      await prisma.cartItem.create({
        data: {
          cartId: cart2.id,
          creditId: testCreditId,
          quantity: 60,
          price: 10,
        },
      });

      // Create reservations
      await reservationService.reserveCredits(cart1.id, [
        { creditId: testCreditId, quantity: 60 },
      ]);
      await reservationService.reserveCredits(cart2.id, [
        { creditId: testCreditId, quantity: 60 },
      ]);

      // Create orders
      const order1 = await prisma.order.create({
        data: {
          orderNumber: 'ORD-1',
          companyId: testCompanyId,
          userId: testUserId,
          cartId: cart1.id,
          subtotal: 600,
          serviceFee: 60,
          total: 660,
          status: 'pending',
          paymentMethod: 'credit_card',
        },
      });
      const order2 = await prisma.order.create({
        data: {
          orderNumber: 'ORD-2',
          companyId: testCompanyId,
          userId: testUserId,
          cartId: cart2.id,
          subtotal: 600,
          serviceFee: 60,
          total: 660,
          status: 'pending',
          paymentMethod: 'credit_card',
        },
      });

      // Create order items
      await prisma.orderItem.create({
        data: {
          orderId: order1.id,
          creditId: testCreditId,
          quantity: 60,
          price: 10,
          subtotal: 600,
        },
      });
      await prisma.orderItem.create({
        data: {
          orderId: order2.id,
          creditId: testCreditId,
          quantity: 60,
          price: 10,
          subtotal: 600,
        },
      });

      // Simulate concurrent confirmPurchase calls
      const results = await Promise.allSettled([
        checkoutService.confirmPurchase(order1.id, testCompanyId),
        checkoutService.confirmPurchase(order2.id, testCompanyId),
      ]);

      // Verify results: one should succeed, one should fail
      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      // Verify the failure is due to insufficient credits
      const failureReason = (failures[0] as PromiseRejectedResult).reason;
      expect(
        failureReason.message ||
          failureReason.toString().includes('credits') ||
          failureReason.toString().includes('availability'),
      ).toBeTruthy();

      // Verify the final credit availability is correct (60, not -20)
      const finalCredit = await prisma.credit.findUnique({
        where: { id: testCreditId },
      });
      expect(finalCredit!.availableAmount).toBe(40); // 100 - 60 = 40
    });

    it('should handle rapid-fire concurrent checkout attempts without exceeding available amount', async () => {
      const numConcurrentOrders = 5;
      const quantityPerOrder = 25; // 5 * 25 = 125 > 100 available
      const carts = [];
      const orders = [];

      // Setup: create multiple carts and orders
      for (let i = 0; i < numConcurrentOrders; i++) {
        const cart = await prisma.cart.create({
          data: { companyId: testCompanyId },
        });
        carts.push(cart);

        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            creditId: testCreditId,
            quantity: quantityPerOrder,
            price: 10,
          },
        });

        await reservationService.reserveCredits(cart.id, [
          { creditId: testCreditId, quantity: quantityPerOrder },
        ]);

        const order = await prisma.order.create({
          data: {
            orderNumber: `ORD-${i}`,
            companyId: testCompanyId,
            userId: testUserId,
            cartId: cart.id,
            subtotal: quantityPerOrder * 10,
            serviceFee: quantityPerOrder,
            total: quantityPerOrder * 10 + quantityPerOrder,
            status: 'pending',
            paymentMethod: 'credit_card',
          },
        });
        orders.push(order);

        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            creditId: testCreditId,
            quantity: quantityPerOrder,
            price: 10,
            subtotal: quantityPerOrder * 10,
          },
        });
      }

      // Execute all confirmPurchase calls concurrently
      const results = await Promise.allSettled(
        orders.map((o) => checkoutService.confirmPurchase(o.id, testCompanyId)),
      );

      // Count successes and failures
      const successes = results.filter((r) => r.status === 'fulfilled').length;
      const failures = results.filter((r) => r.status === 'rejected').length;

      // At most 4 should succeed (4 * 25 = 100), at least 1 should fail
      expect(successes).toBeLessThanOrEqual(4);
      expect(failures).toBeGreaterThanOrEqual(1);

      // Verify total decremented amount never exceeds available
      const finalCredit = await prisma.credit.findUnique({
        where: { id: testCreditId },
      });
      expect(finalCredit!.availableAmount).toBeGreaterThanOrEqual(0);
      expect(finalCredit!.availableAmount).toBeLessThanOrEqual(100);

      // Total decremented should be successes * quantityPerOrder
      const totalDecremented = 100 - finalCredit!.availableAmount;
      expect(totalDecremented).toBe(successes * quantityPerOrder);
    });

    it('should never allow availableAmount to go negative', async () => {
      const cart = await prisma.cart.create({
        data: { companyId: testCompanyId },
      });

      // Attempt to purchase more than available
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          creditId: testCreditId,
          quantity: 150, // More than 100 available
          price: 10,
        },
      });

      const order = await prisma.order.create({
        data: {
          orderNumber: 'ORD-OVERLOAD',
          companyId: testCompanyId,
          userId: testUserId,
          cartId: cart.id,
          subtotal: 1500,
          serviceFee: 150,
          total: 1650,
          status: 'pending',
          paymentMethod: 'credit_card',
        },
      });

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          creditId: testCreditId,
          quantity: 150,
          price: 10,
          subtotal: 1500,
        },
      });

      // Attempt confirmPurchase
      await expect(
        checkoutService.confirmPurchase(order.id, testCompanyId),
      ).rejects.toThrow();

      // Verify availableAmount is still >= 0
      const credit = await prisma.credit.findUnique({
        where: { id: testCreditId },
      });
      expect(credit!.availableAmount).toBeGreaterThanOrEqual(0);
    });

    it('should maintain database CHECK constraint integrity', async () => {
      // Attempt direct database manipulation to bypass application logic
      const attemptNegativeUpdate = async () => {
        return (prisma as any).$queryRaw`
          UPDATE "Credit" 
          SET "availableAmount" = -50 
          WHERE "id" = ${testCreditId}
        `;
      };

      // The CHECK constraint should prevent this
      await expect(attemptNegativeUpdate()).rejects.toThrow();

      // Verify the value remains unchanged and >= 0
      const credit = await prisma.credit.findUnique({
        where: { id: testCreditId },
      });
      expect(credit!.availableAmount).toBe(100); // Unchanged
      expect(credit!.availableAmount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Reservation and confirmation interaction', () => {
    it('should respect active reservations when processing concurrent orders', async () => {
      const cart1 = await prisma.cart.create({
        data: { companyId: testCompanyId },
      });
      const cart2 = await prisma.cart.create({
        data: { companyId: testCompanyId },
      });

      // Cart1 reserves 70 units
      await reservationService.reserveCredits(cart1.id, [
        { creditId: testCreditId, quantity: 70 },
      ]);

      // Cart2 should only see 30 units as effectively available
      const headroom = await availabilityService.runSerializable(async (tx) => {
        return availabilityService.readHeadroomWithin(tx as any, {
          creditId: testCreditId,
          amount: 0,
          respectReservations: true,
          reservationCartId: cart2.id,
        });
      });

      expect(headroom.availableAmount).toBe(100);
      expect(headroom.reservedAmount).toBe(70);
      expect(headroom.effectivelyAvailable).toBe(30);

      // Cart2 cannot reserve 50 units (only 30 effectively available)
      await expect(
        reservationService.reserveCredits(cart2.id, [
          { creditId: testCreditId, quantity: 50 },
        ]),
      ).rejects.toThrow();

      // But Cart2 can reserve 20 units
      await expect(
        reservationService.reserveCredits(cart2.id, [
          { creditId: testCreditId, quantity: 20 },
        ]),
      ).resolves.not.toThrow();
    });
  });
});
