import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { OrderModule } from '../src/order/order.module';
import { PrismaService } from '../src/shared/database/prisma.service';

describe('Order Endpoints (e2e)', () => {
  let app: INestApplication;

  const mockOrders = [
    {
      id: 'order-1',
      orderNumber: 'ORD-001',
      companyId: 'comp-1',
      userId: 'user-1',
      status: 'completed',
      subtotal: 900,
      serviceFee: 50,
      total: 950,
      paymentMethod: 'credit_card',
      transactionHash: '0xabc123',
      paidAt: new Date('2024-03-15'),
      createdAt: new Date('2024-03-15'),
      completedAt: new Date('2024-03-15'),
      items: [
        {
          id: 'item-1',
          orderId: 'order-1',
          creditId: 'credit-1',
          creditName: 'Amazon Credits',
          projectName: 'Amazon Conservation',
          quantity: 100,
          unitPrice: 9.0,
          totalPrice: 900,
          vintage: 2024,
          verificationStandard: 'VERRA',
        },
      ],
      statusEvents: [
        {
          id: 'evt-1',
          orderId: 'order-1',
          status: 'pending',
          message: null,
          createdAt: new Date('2024-03-15T09:00:00Z'),
        },
        {
          id: 'evt-2',
          orderId: 'order-1',
          status: 'completed',
          message: 'Order completed',
          createdAt: new Date('2024-03-15T10:00:00Z'),
        },
      ],
    },
  ];

  const mockTransactions = [
    {
      id: 'txn-1',
      type: 'purchase',
      orderId: 'order-1',
      retirementId: null,
      companyId: 'comp-1',
      userId: 'user-1',
      amount: 950,
      description: 'Carbon credit purchase',
      transactionHash: '0xabc123',
      createdAt: new Date('2024-03-15'),
    },
  ];

  const mockPrisma = {
    order: {
      findMany: jest.fn().mockResolvedValue(mockOrders),
      findFirst: jest.fn().mockResolvedValue(mockOrders[0]),
      count: jest.fn().mockResolvedValue(1),
      aggregate: jest.fn().mockResolvedValue({
        _sum: { total: 950 },
        _count: { id: 1 },
        _avg: { total: 950 },
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    orderStatusEvent: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue(mockOrders[0].statusEvents),
    },
    transaction: {
      findMany: jest.fn().mockResolvedValue(mockTransactions),
      findFirst: jest.fn().mockResolvedValue(mockTransactions[0]),
      count: jest.fn().mockResolvedValue(1),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [OrderModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/orders (GET)', () => {
    it('should return paginated orders', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('x-company-id', 'comp-1')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.total).toBeDefined();
          expect(res.body.page).toBeDefined();
          expect(res.body.limit).toBeDefined();
          expect(res.body.totalPages).toBeDefined();
        });
    });

    it('should accept query parameters', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders?page=1&limit=5&status=completed')
        .set('x-company-id', 'comp-1')
        .expect(200);
    });

    it('should reject invalid status values', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders?status=invalid')
        .set('x-company-id', 'comp-1')
        .expect(400);
    });
  });

  describe('/api/v1/orders/stats (GET)', () => {
    it('should return order statistics', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders/stats')
        .set('x-company-id', 'comp-1')
        .expect(200)
        .expect((res) => {
          expect(res.body.totalSpent).toBeDefined();
          expect(res.body.orderCount).toBeDefined();
          expect(res.body.avgOrderValue).toBeDefined();
        });
    });
  });

  describe('/api/v1/orders/:id (GET)', () => {
    it('should return order details', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders/order-1')
        .set('x-company-id', 'comp-1')
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe('order-1');
          expect(res.body.items).toBeDefined();
        });
    });

    it('should return 404 for non-existent order', () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(null);
      return request(app.getHttpServer())
        .get('/api/v1/orders/nonexistent')
        .set('x-company-id', 'comp-1')
        .expect(404);
    });
  });

  describe('/api/v1/orders/:id/status (GET)', () => {
    it('should return order status with events', () => {
      mockPrisma.order.findFirst.mockResolvedValueOnce(mockOrders[0]);
      return request(app.getHttpServer())
        .get('/api/v1/orders/order-1/status')
        .set('x-company-id', 'comp-1')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBeDefined();
          expect(res.body.events).toBeDefined();
        });
    });
  });

  describe('/api/v1/transactions (GET)', () => {
    it('should return paginated transactions', () => {
      return request(app.getHttpServer())
        .get('/api/v1/transactions')
        .set('x-company-id', 'comp-1')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.total).toBeDefined();
        });
    });

    it('should filter by transaction type', () => {
      return request(app.getHttpServer())
        .get('/api/v1/transactions?type=purchase')
        .set('x-company-id', 'comp-1')
        .expect(200);
    });
  });

  describe('/api/v1/transactions/:id (GET)', () => {
    it('should return transaction details', () => {
      return request(app.getHttpServer())
        .get('/api/v1/transactions/txn-1')
        .set('x-company-id', 'comp-1')
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe('txn-1');
        });
    });
  });

  describe('/api/v1/transactions/export (GET)', () => {
    it('should return CSV file', () => {
      return request(app.getHttpServer())
        .get('/api/v1/transactions/export')
        .set('x-company-id', 'comp-1')
        .expect(200)
        .expect('Content-Type', /text\/csv/);
    });
  });
});
