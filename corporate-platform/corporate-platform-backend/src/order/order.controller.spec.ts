import { Test, TestingModule } from '@nestjs/testing';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { HistoryService } from './services/history.service';
import { TrackingService } from './services/tracking.service';
import { InvoiceService } from './services/invoice.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('OrderController', () => {
  let controller: OrderController;

  const mockUser: JwtPayload = {
    sub: 'user-id',
    email: 'user@example.com',
    companyId: 'company-id',
    role: 'viewer',
    sessionId: 'session-id',
  };

  const mockOrderService = {
    findById: jest.fn(),
    getStats: jest.fn(),
  };
  const mockHistoryService = { getOrders: jest.fn() };
  const mockTrackingService = { getOrderStatus: jest.fn() };
  const mockInvoiceService = { generateInvoice: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        { provide: OrderService, useValue: mockOrderService },
        { provide: HistoryService, useValue: mockHistoryService },
        { provide: TrackingService, useValue: mockTrackingService },
        { provide: InvoiceService, useValue: mockInvoiceService },
      ],
    }).compile();

    controller = module.get<OrderController>(OrderController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call historyService.getOrders for findAll', async () => {
    const query = { page: 1, limit: 10 };
    await controller.findAll(mockUser, query as any);
    expect(mockHistoryService.getOrders).toHaveBeenCalledWith(
      'company-id',
      query,
    );
  });

  it('should call orderService.getStats for getStats', async () => {
    await controller.getStats(mockUser);
    expect(mockOrderService.getStats).toHaveBeenCalledWith('company-id');
  });

  it('should call orderService.findById for findOne', async () => {
    await controller.findOne(mockUser, 'order-1');
    expect(mockOrderService.findById).toHaveBeenCalledWith(
      'order-1',
      'company-id',
    );
  });

  it('should call trackingService.getOrderStatus for getStatus', async () => {
    await controller.getStatus(mockUser, 'order-1');
    expect(mockTrackingService.getOrderStatus).toHaveBeenCalledWith(
      'order-1',
      'company-id',
    );
  });

  it('should call invoiceService and stream PDF for downloadInvoice', async () => {
    const buffer = Buffer.from('pdf-content');
    mockInvoiceService.generateInvoice.mockResolvedValue(buffer);

    const mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };

    await controller.downloadInvoice(mockUser, 'order-1', mockRes as any);
    expect(mockInvoiceService.generateInvoice).toHaveBeenCalledWith(
      'order-1',
      'company-id',
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/pdf',
    );
    expect(mockRes.send).toHaveBeenCalledWith(buffer);
  });
});
