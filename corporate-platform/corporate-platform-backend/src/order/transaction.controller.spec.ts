import { Test, TestingModule } from '@nestjs/testing';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './services/transaction.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('TransactionController', () => {
  let controller: TransactionController;

  const mockUser: JwtPayload = {
    sub: 'user-id',
    email: 'user@example.com',
    companyId: 'company-id',
    role: 'viewer',
    sessionId: 'session-id',
  };

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
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call transactionService.findAll for findAll', async () => {
    const query = { page: 1, limit: 10 };
    await controller.findAll(mockUser, query as any);
    expect(mockTransactionService.findAll).toHaveBeenCalledWith(
      'company-id',
      query,
    );
  });

  it('should call transactionService.findById for findOne', async () => {
    await controller.findOne(mockUser, 'tx-1');
    expect(mockTransactionService.findById).toHaveBeenCalledWith(
      'tx-1',
      'company-id',
    );
  });

  it('should call transactionService.exportCsv and stream CSV', async () => {
    const csvContent = 'ID,Type,Amount\nt1,PURCHASE,100';
    mockTransactionService.exportCsv.mockResolvedValue(csvContent);

    const mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };

    await controller.exportCsv(mockUser, mockRes as any);
    expect(mockTransactionService.exportCsv).toHaveBeenCalledWith('company-id');
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(mockRes.send).toHaveBeenCalledWith(csvContent);
  });
});
