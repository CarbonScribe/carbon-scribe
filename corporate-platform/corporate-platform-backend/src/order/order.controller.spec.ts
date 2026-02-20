import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { TrackingService } from './services/tracking.service';
import { InvoiceService } from './services/invoice.service';

describe('OrderController', () => {
    let controller: OrderController;
    let orderService: OrderService;
    let trackingService: TrackingService;
    let invoiceService: InvoiceService;

    const mockOrderService = {
        findAll: jest.fn(),
        findById: jest.fn(),
        getStats: jest.fn(),
    };

    const mockTrackingService = {
        getOrderStatus: jest.fn(),
    };

    const mockInvoiceService = {
        generateInvoice: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [OrderController],
            providers: [
                { provide: OrderService, useValue: mockOrderService },
                { provide: TrackingService, useValue: mockTrackingService },
                { provide: InvoiceService, useValue: mockInvoiceService },
            ],
        }).compile();

        controller = module.get<OrderController>(OrderController);
        orderService = module.get<OrderService>(OrderService);
        trackingService = module.get<TrackingService>(TrackingService);
        invoiceService = module.get<InvoiceService>(InvoiceService);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('findAll', () => {
        it('should return paginated orders', async () => {
            const expected = { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
            mockOrderService.findAll.mockResolvedValue(expected);

            const result = await controller.findAll(
                { page: 1, limit: 10 },
                'comp-1',
            );

            expect(result).toEqual(expected);
            expect(mockOrderService.findAll).toHaveBeenCalledWith('comp-1', {
                page: 1,
                limit: 10,
            });
        });

        it('should use default company id when header is missing', async () => {
            const expected = { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
            mockOrderService.findAll.mockResolvedValue(expected);

            await controller.findAll({ page: 1, limit: 10 }, undefined);

            expect(mockOrderService.findAll).toHaveBeenCalledWith(
                'default-company',
                expect.any(Object),
            );
        });
    });

    describe('getStats', () => {
        it('should return order statistics', async () => {
            const stats = { totalSpent: 1000, orderCount: 5, avgOrderValue: 200 };
            mockOrderService.getStats.mockResolvedValue(stats);

            const result = await controller.getStats('comp-1');

            expect(result).toEqual(stats);
        });
    });

    describe('findOne', () => {
        it('should return an order by id', async () => {
            const order = { id: '1', orderNumber: 'ORD-001' };
            mockOrderService.findById.mockResolvedValue(order);

            const result = await controller.findOne('1', 'comp-1');

            expect(result).toEqual(order);
        });

        it('should throw NotFoundException when order not found', async () => {
            mockOrderService.findById.mockResolvedValue(null);

            await expect(controller.findOne('nonexistent', 'comp-1')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('getStatus', () => {
        it('should return order status with events', async () => {
            const status = {
                status: 'completed',
                updatedAt: new Date(),
                events: [],
            };
            mockTrackingService.getOrderStatus.mockResolvedValue(status);

            const result = await controller.getStatus('1', 'comp-1');

            expect(result).toEqual(status);
        });

        it('should throw NotFoundException when order not found', async () => {
            mockTrackingService.getOrderStatus.mockResolvedValue(null);

            await expect(controller.getStatus('nonexistent', 'comp-1')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('downloadInvoice', () => {
        it('should send PDF buffer as response', async () => {
            const pdfBuffer = Buffer.from('fake-pdf');
            mockInvoiceService.generateInvoice.mockResolvedValue(pdfBuffer);

            const mockRes = {
                set: jest.fn(),
                end: jest.fn(),
            };

            await controller.downloadInvoice('1', 'comp-1', mockRes as any);

            expect(mockRes.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    'Content-Type': 'application/pdf',
                }),
            );
            expect(mockRes.end).toHaveBeenCalledWith(pdfBuffer);
        });
    });
});
