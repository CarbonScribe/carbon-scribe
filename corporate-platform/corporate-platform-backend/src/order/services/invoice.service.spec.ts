import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceService } from './invoice.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('InvoiceService', () => {
  let service: InvoiceService;

  const mockPrisma = {
    order: {
      findFirst: jest.fn(),
    },
  };

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

  it('should throw NotFoundException if order not found', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null);
    await expect(service.generateInvoice('missing', 'comp-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw NotFoundException if order not completed', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
      items: [],
    });
    await expect(service.generateInvoice('order-1', 'comp-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should generate PDF buffer for completed order', async () => {
    const mockOrder = {
      id: 'order-1',
      orderNumber: 'ORD-001',
      status: 'COMPLETED',
      createdAt: new Date('2024-06-15'),
      subtotal: 100,
      serviceFee: 5,
      total: 105,
      paymentMethod: 'card',
      transactionHash: '0xabc',
      company: { name: 'Test Corp' },
      items: [
        {
          creditName: 'Carbon Credit A',
          projectName: 'Wind Farm',
          quantity: 10,
          unitPrice: 10,
          totalPrice: 100,
        },
      ],
    };
    mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

    const result = await service.generateInvoice('order-1', 'comp-1');
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });
});
