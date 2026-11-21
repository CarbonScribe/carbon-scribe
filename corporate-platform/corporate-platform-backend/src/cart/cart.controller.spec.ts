import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CheckoutDto, ConfirmCheckoutDto } from './dto/checkout.dto';
import { IdempotencyInterceptor } from '../shared/idempotency/idempotency.interceptor';
import { IdempotencyService } from '../shared/idempotency/idempotency.service';

describe('CartController (Idempotency)', () => {
  let controller: CartController;
  let cartService: jest.Mocked<CartService>;

  const mockCartService = {
    getCart: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    removeItem: jest.fn(),
    clearCart: jest.fn(),
    checkout: jest.fn(),
    confirmPurchase: jest.fn(),
    getOrders: jest.fn(),
    getOrderById: jest.fn(),
  };

  const mockIdempotencyService = {
    acquire: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
    cleanupExpired: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        { provide: CartService, useValue: mockCartService },
        { provide: IdempotencyService, useValue: mockIdempotencyService },
        IdempotencyInterceptor,
      ],
    }).compile();

    controller = module.get<CartController>(CartController);
    cartService = module.get(CartService);
  });

  const user = {
    companyId: 'company-123',
    sub: 'user-456',
    email: 'user@example.com',
    role: 'buyer',
  } as any;

  it('checkout delegates to cartService.checkout', async () => {
    const dto: CheckoutDto = {
      paymentMethod: 'credit_card',
      notes: 'test order',
    };
    const mockOrder = {
      orderId: 'ord-1',
      orderNumber: 'ORD-001',
      status: 'pending',
    };
    mockCartService.checkout.mockResolvedValue(mockOrder);

    const result = await controller.checkout(user, dto);

    expect(cartService.checkout).toHaveBeenCalledWith(
      'company-123',
      'user-456',
      dto,
    );
    expect(result).toBe(mockOrder);
  });

  it('confirmPurchase delegates to cartService.confirmPurchase', async () => {
    const dto: ConfirmCheckoutDto = { orderId: 'ord-1' };
    const mockConfirmed = {
      orderId: 'ord-1',
      orderNumber: 'ORD-001',
      status: 'completed',
    };
    mockCartService.confirmPurchase.mockResolvedValue(mockConfirmed);

    const result = await controller.confirmPurchase(user, dto);

    expect(cartService.confirmPurchase).toHaveBeenCalledWith(
      'ord-1',
      'company-123',
    );
    expect(result).toBe(mockConfirmed);
  });

  it('has IdempotencyInterceptor decorated on checkout and confirmPurchase', () => {
    const checkoutInterceptors = Reflect.getMetadata(
      '__interceptors__',
      CartController.prototype.checkout,
    );
    expect(checkoutInterceptors).toBeDefined();
    expect(checkoutInterceptors).toContain(IdempotencyInterceptor);

    const confirmInterceptors = Reflect.getMetadata(
      '__interceptors__',
      CartController.prototype.confirmPurchase,
    );
    expect(confirmInterceptors).toBeDefined();
    expect(confirmInterceptors).toContain(IdempotencyInterceptor);
  });
});
