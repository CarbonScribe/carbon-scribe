import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './services/transaction.service';

describe('TransactionController', () => {
    let controller: TransactionController;
    let transactionService: TransactionService;

    const mockTransactionService = {
        findAll: jest.fn(),
        findById: jest.fn(),
        exportCsv: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [TransactionController],
            providers: [
                { provide: TransactionService, useValue: mockTransactionService },
            ],
        }).compile();

        controller = module.get<TransactionController>(TransactionController);
        transactionService = module.get<TransactionService>(TransactionService);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('findAll', () => {
        it('should return paginated transactions', async () => {
            const expected = {
                data: [],
                total: 0,
                page: 1,
                limit: 10,
                totalPages: 0,
            };
            mockTransactionService.findAll.mockResolvedValue(expected);

            const result = await controller.findAll(
                { page: 1, limit: 10 },
                'comp-1',
            );

            expect(result).toEqual(expected);
        });
    });

    describe('exportCsv', () => {
        it('should send CSV as response', async () => {
            mockTransactionService.exportCsv.mockResolvedValue('ID,Type\n1,purchase');

            const mockRes = {
                set: jest.fn(),
                send: jest.fn(),
            };

            await controller.exportCsv('comp-1', mockRes as any);

            expect(mockRes.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    'Content-Type': 'text/csv',
                }),
            );
            expect(mockRes.send).toHaveBeenCalledWith('ID,Type\n1,purchase');
        });
    });

    describe('findOne', () => {
        it('should return a transaction by id', async () => {
            const transaction = { id: '1', type: 'purchase' };
            mockTransactionService.findById.mockResolvedValue(transaction);

            const result = await controller.findOne('1', 'comp-1');

            expect(result).toEqual(transaction);
        });

        it('should throw NotFoundException when transaction not found', async () => {
            mockTransactionService.findById.mockResolvedValue(null);

            await expect(
                controller.findOne('nonexistent', 'comp-1'),
            ).rejects.toThrow(NotFoundException);
        });
    });
});
