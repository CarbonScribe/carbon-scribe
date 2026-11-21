import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { CartController } from '../src/cart/cart.controller';
import { CartService } from '../src/cart/cart.service';
import { IdempotencyInterceptor } from '../src/shared/idempotency/idempotency.interceptor';
import { IdempotencyService } from '../src/shared/idempotency/idempotency.service';
import { PrismaService } from '../src/shared/database/prisma.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';

describe('Checkout Idempotency (e2e)', () => {
  let app: INestApplication;
  let orderCounter = 0;
  let confirmCounter = 0;

  // In-memory store for idempotency records simulating database unique constraints
  const idempotencyRecords = new Map<string, any>();

  const mockCartService = {
    checkout: jest.fn(async (companyId: string, userId: string, dto: any) => {
      orderCounter++;
      return {
        orderId: `order-${orderCounter}`,
        orderNumber: `ORD-00${orderCounter}`,
        companyId,
        userId,
        status: 'pending',
        paymentMethod: dto.paymentMethod,
        notes: dto.notes,
      };
    }),
    confirmPurchase: jest.fn(async (orderId: string, companyId: string) => {
      confirmCounter++;
      return {
        orderId,
        orderNumber: `ORD-00${confirmCounter}`,
        companyId,
        status: 'completed',
      };
    }),
  };

  const mockPrisma = {
    idempotencyRecord: {
      findFirst: jest.fn(async ({ where }) => {
        const compositeKey = `${where.companyId}:${where.key}`;
        const record = idempotencyRecords.get(compositeKey);
        return record ? { ...record } : null;
      }),
      create: jest.fn(async ({ data }) => {
        const compositeKey = `${data.companyId}:${data.key}`;
        if (idempotencyRecords.has(compositeKey)) {
          const error: any = new Error(
            'Unique constraint failed on the fields: (`companyId`,`key`)',
          );
          error.code = 'P2002';
          throw error;
        }
        const record = {
          id: `rec-${Date.now()}-${Math.random()}`,
          ...data,
          createdAt: new Date(),
        };
        idempotencyRecords.set(compositeKey, record);
        return { ...record };
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        let count = 0;
        for (const [_, record] of idempotencyRecords.entries()) {
          const matchCompany =
            !where.companyId || record.companyId === where.companyId;
          const matchKey = !where.key || record.key === where.key;
          const matchId = !where.id || record.id === where.id;
          const matchStatus = !where.status || record.status === where.status;
          if (matchCompany && matchKey && matchId && matchStatus) {
            Object.assign(record, data);
            count++;
          }
        }
        return { count };
      }),
      deleteMany: jest.fn(async ({ where }) => {
        let count = 0;
        for (const [compositeKey, record] of idempotencyRecords.entries()) {
          if (where.expiresAt?.lt && record.expiresAt < where.expiresAt.lt) {
            idempotencyRecords.delete(compositeKey);
            count++;
          }
        }
        return { count };
      }),
    },
  };

  let activeCompanyId = 'company-test-1';

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        { provide: CartService, useValue: mockCartService },
        { provide: PrismaService, useValue: mockPrisma },
        IdempotencyService,
        IdempotencyInterceptor,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            companyId: activeCompanyId,
            sub: 'user-test-1',
            email: 'buyer@example.com',
            role: 'buyer',
          };
          req.companyId = activeCompanyId;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    idempotencyRecords.clear();
    orderCounter = 0;
    confirmCounter = 0;
    activeCompanyId = 'company-test-1';
    jest.clearAllMocks();
  });

  const VALID_KEY_1 = 'a0000000-0000-4000-8000-000000000001';
  const CONFIRM_KEY_1 = 'c0000000-0000-4000-8000-000000000003';

  describe('POST /api/v1/cart/checkout', () => {
    it('creates an order on the first request and returns the original order on replay with same key', async () => {
      const payload = {
        paymentMethod: 'credit_card',
        notes: 'Urgent delivery',
      };

      // First request
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/cart/checkout')
        .set('Idempotency-Key', VALID_KEY_1)
        .send(payload);

      expect(res1.status).toBe(201);
      expect(res1.body.orderId).toBe('order-1');
      expect(res1.headers['idempotency-key']).toBe(VALID_KEY_1);
      expect(res1.headers['idempotency-replay']).toBe('false');
      expect(mockCartService.checkout).toHaveBeenCalledTimes(1);

      // Replay request with exact same payload and key
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/cart/checkout')
        .set('Idempotency-Key', VALID_KEY_1)
        .send(payload);

      expect(res2.status).toBe(201);
      expect(res2.body.orderId).toBe('order-1'); // Exact same order!
      expect(res2.headers['idempotency-key']).toBe(VALID_KEY_1);
      expect(res2.headers['idempotency-replay']).toBe('true');
      expect(mockCartService.checkout).toHaveBeenCalledTimes(1); // Handler NOT called again!
    });

    it('rejects replay with a different payload returning 422 Unprocessable Entity', async () => {
      const payload1 = { paymentMethod: 'credit_card', notes: 'Order 1' };
      const payload2 = { paymentMethod: 'wire', notes: 'Changed payload' };

      // Initial request
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/cart/checkout')
        .set('Idempotency-Key', VALID_KEY_1)
        .send(payload1);

      expect(res1.status).toBe(201);
      expect(res1.body.orderId).toBe('order-1');

      // Replay with different body
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/cart/checkout')
        .set('Idempotency-Key', VALID_KEY_1)
        .send(payload2);

      expect(res2.status).toBe(422);
      expect(res2.body.message).toContain(
        'Idempotency key reused with different request payload',
      );
      expect(mockCartService.checkout).toHaveBeenCalledTimes(1);
    });

    it('handles concurrent duplicate requests producing exactly one order', async () => {
      const payload = { paymentMethod: 'credit_card' };

      // Simulate a handler that takes 50ms so both requests race concurrently
      mockCartService.checkout.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  orderId: 'order-concurrent',
                  orderNumber: 'ORD-CONC',
                  companyId: activeCompanyId,
                  userId: 'user-test-1',
                  status: 'pending',
                  paymentMethod: 'credit_card',
                  notes: undefined,
                }),
              50,
            ),
          ),
      );

      // Send two simultaneous requests with the same key
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/cart/checkout')
          .set('Idempotency-Key', VALID_KEY_1)
          .send(payload),
        request(app.getHttpServer())
          .post('/api/v1/cart/checkout')
          .set('Idempotency-Key', VALID_KEY_1)
          .send(payload),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // One request must succeed (201), the concurrent duplicate must receive 409 Conflict
      expect(statuses).toEqual([201, 409]);

      const conflictRes = res1.status === 409 ? res1 : res2;
      expect(conflictRes.body.message).toContain('in progress');
      expect(mockCartService.checkout).toHaveBeenCalledTimes(1);
    });

    it('scopes idempotency keys per company to prevent cross-tenant collisions', async () => {
      const payload = { paymentMethod: 'credit_card' };

      // Company A executes checkout with VALID_KEY_1
      activeCompanyId = 'company-tenant-A';
      const resA = await request(app.getHttpServer())
        .post('/api/v1/cart/checkout')
        .set('Idempotency-Key', VALID_KEY_1)
        .send(payload);

      expect(resA.status).toBe(201);
      expect(resA.body.orderId).toBe('order-1');
      expect(resA.body.companyId).toBe('company-tenant-A');

      // Company B executes checkout with the EXACT SAME KEY VALID_KEY_1
      activeCompanyId = 'company-tenant-B';
      const resB = await request(app.getHttpServer())
        .post('/api/v1/cart/checkout')
        .set('Idempotency-Key', VALID_KEY_1)
        .send(payload);

      expect(resB.status).toBe(201);
      expect(resB.body.orderId).toBe('order-2');
      expect(resB.body.companyId).toBe('company-tenant-B');

      // Both orders were created independently without colliding
      expect(mockCartService.checkout).toHaveBeenCalledTimes(2);
    });

    it('rejects invalid non-UUID Idempotency-Key header with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/cart/checkout')
        .set('Idempotency-Key', 'invalid-non-uuid-key')
        .send({ paymentMethod: 'credit_card' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('valid UUID');
      expect(mockCartService.checkout).not.toHaveBeenCalled();
    });

    it('requires Idempotency-Key in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const res = await request(app.getHttpServer())
          .post('/api/v1/cart/checkout')
          .send({ paymentMethod: 'credit_card' });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('required in production');
        expect(mockCartService.checkout).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('POST /api/v1/checkout/confirm', () => {
    it('confirms order and returns cached result on replay', async () => {
      const payload = { orderId: 'order-123' };

      // First confirmation request
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/checkout/confirm')
        .set('Idempotency-Key', CONFIRM_KEY_1)
        .send(payload);

      expect(res1.status).toBe(201);
      expect(res1.body.status).toBe('completed');
      expect(res1.headers['idempotency-key']).toBe(CONFIRM_KEY_1);
      expect(res1.headers['idempotency-replay']).toBe('false');
      expect(mockCartService.confirmPurchase).toHaveBeenCalledTimes(1);

      // Replay confirmation request
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/checkout/confirm')
        .set('Idempotency-Key', CONFIRM_KEY_1)
        .send(payload);

      expect(res2.status).toBe(201);
      expect(res2.body.status).toBe('completed');
      expect(res2.headers['idempotency-key']).toBe(CONFIRM_KEY_1);
      expect(res2.headers['idempotency-replay']).toBe('true');
      expect(mockCartService.confirmPurchase).toHaveBeenCalledTimes(1);
    });

    it('rejects confirmation replay with different orderId returning 422', async () => {
      const payload1 = { orderId: 'order-123' };
      const payload2 = { orderId: 'order-999' };

      await request(app.getHttpServer())
        .post('/api/v1/checkout/confirm')
        .set('Idempotency-Key', CONFIRM_KEY_1)
        .send(payload1);

      const res2 = await request(app.getHttpServer())
        .post('/api/v1/checkout/confirm')
        .set('Idempotency-Key', CONFIRM_KEY_1)
        .send(payload2);

      expect(res2.status).toBe(422);
      expect(res2.body.message).toContain(
        'reused with different request payload',
      );
    });
  });
});
