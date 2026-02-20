import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { PrismaService } from '../../shared/database/prisma.service';

// Mock pdfkit
jest.mock('pdfkit', () => {
    const EventEmitter = require('events');
    return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => {
            const emitter = new EventEmitter();
            const doc = {
                on: emitter.on.bind(emitter),
                emit: emitter.emit.bind(emitter),
                fontSize: jest.fn().mockReturnThis(),
                text: jest.fn().mockReturnThis(),
                moveDown: jest.fn().mockReturnThis(),
                moveTo: jest.fn().mockReturnThis(),
                lineTo: jest.fn().mockReturnThis(),
                stroke: jest.fn().mockReturnThis(),
                font: jest.fn().mockReturnThis(),
                currentLineHeight: jest.fn().mockReturnValue(12),
                y: 100,
                end: jest.fn().mockImplementation(function () {
                    const chunk = Buffer.from('mock-pdf-content');
                    emitter.emit('data', chunk);
                    emitter.emit('end');
                }),
            };
            return doc;
        }),
    };
});

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

    describe('generateInvoice', () => {
        it('should generate a PDF buffer for a completed order', async () => {
            mockPrisma.order.findFirst.mockResolvedValue({
                id: '1',
                orderNumber: 'ORD-001',
                companyId: 'comp-1',
                status: 'completed',
                subtotal: 900,
                serviceFee: 50,
                total: 950,
                paymentMethod: 'credit_card',
                transactionHash: '0xabc123',
                paidAt: new Date('2024-03-15'),
                createdAt: new Date('2024-03-15'),
                items: [
                    {
                        id: 'item-1',
                        creditName: 'Amazon Rainforest Credits',
                        projectName: 'Amazon Conservation',
                        quantity: 100,
                        unitPrice: 9.0,
                        totalPrice: 900,
                    },
                ],
            });

            const result = await service.generateInvoice('1', 'comp-1');

            expect(result).toBeInstanceOf(Buffer);
            expect(result.length).toBeGreaterThan(0);
        });

        it('should throw NotFoundException when order not found', async () => {
            mockPrisma.order.findFirst.mockResolvedValue(null);

            await expect(
                service.generateInvoice('nonexistent', 'comp-1'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw NotFoundException for non-completed orders', async () => {
            mockPrisma.order.findFirst.mockResolvedValue({
                id: '1',
                status: 'pending',
                items: [],
            });

            await expect(
                service.generateInvoice('1', 'comp-1'),
            ).rejects.toThrow(NotFoundException);
        });
    });
});
