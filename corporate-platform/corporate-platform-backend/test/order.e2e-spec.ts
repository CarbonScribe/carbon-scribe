import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import * as request from 'supertest';
import { OrderController } from '../src/order/order.controller';
import { TransactionController } from '../src/order/transaction.controller';
import { OrderService } from '../src/order/order.service';
import { HistoryService } from '../src/order/services/history.service';
import { TrackingService } from '../src/order/services/tracking.service';
import { InvoiceService } from '../src/order/services/invoice.service';
import { TransactionService } from '../src/order/services/transaction.service';
import { PrismaService } from '../src/shared/database/prisma.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';

const mockGuard: CanActivate = {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = {
      sub: 'test-user',
      email: 'test@example.com',
      companyId: 'test-company',
      role: 'admin',
      sessionId: 'test-session',
    };
    return true;
  },
};

describe('Order & Transaction Endpoints (e2e)', () => {
  let app: INestApplication;

  const mockPrisma = {
    order: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({
        _sum: { total: 1000 },
        _count: { id: 5 },
        _avg: { total: 200 },
      }),
      groupBy: jest.fn().mockResolvedValue([
        { status: 'COMPLETED', _count: { id: 3 } },
        { status: 'PENDING', _count: { id: 2 } },
      ]),
    },
    orderStatusEvent: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    transaction: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OrderController, TransactionController],
      providers: [
        OrderService,
        HistoryService,
        TrackingService,
        InvoiceService,
        TransactionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/orders', () => {
    it('should return paginated orders', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page');
        });
    });

    it('should accept query parameters', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders?page=1&limit=5&status=COMPLETED')
        .expect(200);
    });
  });

  describe('GET /api/v1/orders/stats', () => {
    it('should return order statistics', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders/stats')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalSpent');
          expect(res.body).toHaveProperty('orderCount');
          expect(res.body).toHaveProperty('avgOrderValue');
        });
    });
  });

  describe('GET /api/v1/orders/:id', () => {
    it('should return 404 for non-existent order', () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);
      return request(app.getHttpServer())
        .get('/api/v1/orders/non-existent')
        .expect(404);
    });

    it('should return order details when found', () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'ORD-001',
        status: 'COMPLETED',
        items: [],
        statusEvents: [],
      });
      return request(app.getHttpServer())
        .get('/api/v1/orders/order-1')
        .expect(200)
        .expect((res) => {
          expect(res.body.orderNumber).toBe('ORD-001');
        });
    });
  });

  describe('GET /api/v1/transactions', () => {
    it('should return paginated transactions', () => {
      return request(app.getHttpServer())
        .get('/api/v1/transactions')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
        });
    });
  });

  describe('GET /api/v1/transactions/export', () => {
    it('should return CSV content', () => {
      return request(app.getHttpServer())
        .get('/api/v1/transactions/export')
        .expect(200)
        .expect('Content-Type', /text\/csv/);
    });
  });

  describe('GET /api/v1/transactions/:id', () => {
    it('should return 404 for non-existent transaction', () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      return request(app.getHttpServer())
        .get('/api/v1/transactions/non-existent')
        .expect(404);
    });
  });
});
