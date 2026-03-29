import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { HistoryService } from './services/history.service';
import { TrackingService } from './services/tracking.service';
import { InvoiceService } from './services/invoice.service';
import { TransactionService } from './services/transaction.service';

describe('OrderService', () => {
  let service: OrderService;

  const mockHistoryService = {
    getOrders: jest.fn(),
    getOrderById: jest.fn(),
    getStats: jest.fn(),
  };

  const mockTrackingService = {
    getOrderStatus: jest.fn(),
  };

  const mockInvoiceService = {
    generateInvoice: jest.fn(),
  };

  const mockTransactionService = {
    getTransactions: jest.fn(),
    getTransactionById: jest.fn(),
    exportCsv: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: HistoryService, useValue: mockHistoryService },
        { provide: TrackingService, useValue: mockTrackingService },
        { provide: InvoiceService, useValue: mockInvoiceService },
        { provide: TransactionService, useValue: mockTransactionService },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('delegates getOrders to HistoryService', async () => {
    const expected = { data: [], total: 0, page: 1, limit: 10 };
    mockHistoryService.getOrders.mockResolvedValue(expected);

    const result = await service.getOrders('company-1', { page: 1, limit: 10 });

    expect(mockHistoryService.getOrders).toHaveBeenCalledWith('company-1', {
      page: 1,
      limit: 10,
    });
    expect(result).toBe(expected);
  });

  it('delegates getOrderById to HistoryService', async () => {
    const expected = { id: 'order-1' };
    mockHistoryService.getOrderById.mockResolvedValue(expected);

    const result = await service.getOrderById('company-1', 'order-1');

    expect(mockHistoryService.getOrderById).toHaveBeenCalledWith(
      'company-1',
      'order-1',
    );
    expect(result).toBe(expected);
  });

  it('delegates getOrderStats to HistoryService', async () => {
    const expected = {
      totalSpent: 50000,
      orderCount: 5,
      avgOrderValue: 10000,
      byStatus: { completed: 5 },
    };
    mockHistoryService.getStats.mockResolvedValue(expected);

    const result = await service.getOrderStats('company-1');

    expect(mockHistoryService.getStats).toHaveBeenCalledWith('company-1');
    expect(result).toBe(expected);
  });

  it('delegates getOrderStatus to TrackingService', async () => {
    const expected = { orderId: 'order-1', status: 'completed', events: [] };
    mockTrackingService.getOrderStatus.mockResolvedValue(expected);

    const result = await service.getOrderStatus('company-1', 'order-1');

    expect(mockTrackingService.getOrderStatus).toHaveBeenCalledWith(
      'company-1',
      'order-1',
    );
    expect(result).toBe(expected);
  });

  it('delegates generateInvoice to InvoiceService', async () => {
    const mockRes = {} as any;
    mockInvoiceService.generateInvoice.mockResolvedValue(undefined);

    await service.generateInvoice('company-1', 'order-1', mockRes);

    expect(mockInvoiceService.generateInvoice).toHaveBeenCalledWith(
      'company-1',
      'order-1',
      mockRes,
    );
  });

  it('delegates getTransactions to TransactionService', async () => {
    const expected = { data: [], total: 0, page: 1, limit: 10 };
    mockTransactionService.getTransactions.mockResolvedValue(expected);

    const result = await service.getTransactions('company-1', {
      page: 1,
      limit: 10,
    });

    expect(mockTransactionService.getTransactions).toHaveBeenCalledWith(
      'company-1',
      { page: 1, limit: 10 },
    );
    expect(result).toBe(expected);
  });

  it('delegates getTransactionById to TransactionService', async () => {
    const expected = { id: 'tx-1', amount: 100 };
    mockTransactionService.getTransactionById.mockResolvedValue(expected);

    const result = await service.getTransactionById('company-1', 'tx-1');

    expect(mockTransactionService.getTransactionById).toHaveBeenCalledWith(
      'company-1',
      'tx-1',
    );
    expect(result).toBe(expected);
  });

  it('delegates exportTransactionsCsv to TransactionService', async () => {
    mockTransactionService.exportCsv.mockResolvedValue('csv-data');

    const result = await service.exportTransactionsCsv('company-1');

    expect(mockTransactionService.exportCsv).toHaveBeenCalledWith('company-1');
    expect(result).toBe('csv-data');
  });
});
