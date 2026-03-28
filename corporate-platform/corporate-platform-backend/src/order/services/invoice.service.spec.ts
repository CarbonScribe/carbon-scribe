import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceService } from './invoice.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// Mock PDFDocument so no actual PDF is streamed in tests
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => ({
    pipe: jest.fn(),
    end: jest.fn(),
    fillColor: jest.fn().mockReturnThis(),
    fontSize: jest.fn().mockReturnThis(),
    font: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    stroke: jest.fn().mockReturnThis(),
    y: 100,
  }));
});

describe('InvoiceService', () => {
  let service: InvoiceService;

  const mockPrisma = {
    order: {
      findUnique: jest.fn(),
    },
  };

  const mockCompletedOrder = {
    id: 'order-1',
    orderNumber: 'ORD-2026-0001',
    companyId: 'company-1',
    status: 'completed',
    subtotal: 10000,
    serviceFee: 500,
    total: 10500,
    paymentMethod: 'credit_card',
    transactionHash: 'tx_hash_001',
    paidAt: new Date('2026-01-15'),
    createdAt: new Date('2026-01-15'),
    company: { name: 'Acme Corp' },
    items: [
      {
        id: 'item-1',
        quantity: 1000,
        price: 10,
        subtotal: 10000,
        credit: { projectName: 'Solar Farm Kenya' },
      },
    ],
  };

  const mockRes = {
    setHeader: jest.fn(),
    send: jest.fn(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateInvoice', () => {
    it('sets correct response headers for a completed order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockCompletedOrder);

      await service.generateInvoice('company-1', 'order-1', mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=invoice-ORD-2026-0001.pdf',
      );
    });

    it('throws NotFoundException when order is not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.generateInvoice('company-1', 'nonexistent', mockRes),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for cross-company access', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...mockCompletedOrder,
        companyId: 'other-company',
      });

      await expect(
        service.generateInvoice('company-1', 'order-1', mockRes),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for non-completed orders', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...mockCompletedOrder,
        status: 'pending',
      });

      await expect(
        service.generateInvoice('company-1', 'order-1', mockRes),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for failed orders', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...mockCompletedOrder,
        status: 'failed',
      });

      await expect(
        service.generateInvoice('company-1', 'order-1', mockRes),
      ).rejects.toThrow(BadRequestException);
    });

    it('uses createdAt when paidAt is null', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...mockCompletedOrder,
        paidAt: null,
      });

      // Should not throw; fallback to createdAt
      await expect(
        service.generateInvoice('company-1', 'order-1', mockRes),
      ).resolves.toBeUndefined();
    });
  });
});
