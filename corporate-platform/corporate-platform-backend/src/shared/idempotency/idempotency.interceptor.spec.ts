import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let service: jest.Mocked<IdempotencyService>;

  const mockService = {
    acquire: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
    cleanupExpired: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = mockService as any;
    interceptor = new IdempotencyInterceptor(service);
  });

  const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
  const COMPANY_ID = 'company-test-123';

  function createMockContext(
    headers: Record<string, string> = {},
    body: any = {},
    user: any = { companyId: COMPANY_ID },
  ): {
    context: ExecutionContext;
    response: {
      status: jest.Mock;
      setHeader: jest.Mock;
      statusCode: number;
    };
  } {
    const response = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      statusCode: 201,
    };

    const request = {
      headers,
      body,
      user,
      url: '/api/v1/cart/checkout',
      route: { path: '/api/v1/cart/checkout' },
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    return { context, response };
  }

  function createMockCallHandler(result: any = { id: 'order-1' }): CallHandler {
    return {
      handle: jest.fn(() => of(result)),
    };
  }

  describe('production requirement', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('throws BadRequestException (400) if Idempotency-Key is missing in production', async () => {
      process.env.NODE_ENV = 'production';
      const { context } = createMockContext({});
      const handler = createMockCallHandler();

      await expect(interceptor.intercept(context, handler)).rejects.toThrow(
        BadRequestException,
      );
      expect(handler.handle).not.toHaveBeenCalled();
    });

    it('passes through to handler without error if Idempotency-Key is missing in non-production', async () => {
      process.env.NODE_ENV = 'test';
      const { context } = createMockContext({});
      const handler = createMockCallHandler({ ok: true });

      const result$ = await interceptor.intercept(context, handler);
      let emitted: any;
      result$.subscribe((val) => (emitted = val));

      expect(emitted).toEqual({ ok: true });
      expect(handler.handle).toHaveBeenCalled();
      expect(service.acquire).not.toHaveBeenCalled();
    });
  });

  describe('key and context validation', () => {
    it('throws BadRequestException if Idempotency-Key is not a valid UUID', async () => {
      const { context } = createMockContext({
        'idempotency-key': 'not-a-valid-uuid',
      });
      const handler = createMockCallHandler();

      await expect(interceptor.intercept(context, handler)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if company context is missing', async () => {
      const { context } = createMockContext(
        { 'idempotency-key': VALID_UUID },
        {},
        null, // No user / companyId
      );
      const handler = createMockCallHandler();

      await expect(interceptor.intercept(context, handler)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('interceptor lifecycle', () => {
    it('on first request: acquires lock, runs handler, completes record, sets headers', async () => {
      const { context, response } = createMockContext(
        { 'idempotency-key': VALID_UUID },
        { paymentMethod: 'credit_card' },
      );
      const orderResult = { orderId: 'ord-123', status: 'pending' };
      const handler = createMockCallHandler(orderResult);

      service.acquire.mockResolvedValue({ isReplay: false });
      service.complete.mockResolvedValue(undefined);

      const observable = await interceptor.intercept(context, handler);
      let emitted: any;
      await new Promise<void>((resolve, reject) => {
        observable.subscribe({
          next: (val) => {
            emitted = val;
          },
          error: reject,
          complete: resolve,
        });
      });

      expect(emitted).toEqual(orderResult);
      expect(handler.handle).toHaveBeenCalled();
      expect(service.complete).toHaveBeenCalledWith(
        VALID_UUID,
        COMPANY_ID,
        201,
        orderResult,
      );
      expect(response.setHeader).toHaveBeenCalledWith(
        'Idempotency-Key',
        VALID_UUID,
      );
      expect(response.setHeader).toHaveBeenCalledWith(
        'Idempotency-Replay',
        'false',
      );
    });

    it('on replay with same key & payload: does not call handler, returns cached response', async () => {
      const { context, response } = createMockContext(
        { 'idempotency-key': VALID_UUID },
        { paymentMethod: 'credit_card' },
      );
      const cachedOrder = { orderId: 'ord-cached', status: 'pending' };
      const handler = createMockCallHandler();

      service.acquire.mockResolvedValue({
        isReplay: true,
        responseStatus: 201,
        responseBody: cachedOrder,
      });

      const observable = await interceptor.intercept(context, handler);
      let emitted: any;
      await new Promise<void>((resolve, reject) => {
        observable.subscribe({
          next: (val) => {
            emitted = val;
          },
          error: reject,
          complete: resolve,
        });
      });

      expect(emitted).toEqual(cachedOrder);
      expect(handler.handle).not.toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(201);
      expect(response.setHeader).toHaveBeenCalledWith(
        'Idempotency-Key',
        VALID_UUID,
      );
      expect(response.setHeader).toHaveBeenCalledWith(
        'Idempotency-Replay',
        'true',
      );
    });

    it('on handler failure: calls fail() and propagates error', async () => {
      const { context } = createMockContext(
        { 'idempotency-key': VALID_UUID },
        { paymentMethod: 'credit_card' },
      );
      const error = new Error('Database connection failed');
      const handler: CallHandler = {
        handle: jest.fn(() => throwError(() => error)),
      };

      service.acquire.mockResolvedValue({ isReplay: false });
      service.fail.mockResolvedValue(undefined);

      const observable = await interceptor.intercept(context, handler);

      await expect(
        new Promise((resolve, reject) => {
          observable.subscribe({
            next: resolve,
            error: reject,
          });
        }),
      ).rejects.toThrow('Database connection failed');

      expect(service.fail).toHaveBeenCalledWith(VALID_UUID, COMPANY_ID);
    });
  });
});
