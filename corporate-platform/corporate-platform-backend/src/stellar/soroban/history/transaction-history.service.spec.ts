import { TransactionHistoryService } from './transaction-history.service';

describe('TransactionHistoryService', () => {
  const prisma = {
    contractCall: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  } as any;

  const sorobanService = {
    getTransaction: jest.fn(),
  } as any;

  let service: TransactionHistoryService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new TransactionHistoryService(prisma, sorobanService);
  });

  it('returns paged company transactions with on-chain enrichment', async () => {
    prisma.contractCall.findMany.mockResolvedValueOnce([
      {
        id: '1',
        transactionHash: 'abc123',
        companyId: 'company-1',
        contractId: 'contract',
        methodName: 'transfer',
        args: [],
        status: 'CONFIRMED',
        submittedAt: new Date(),
      },
    ]);
    prisma.contractCall.count.mockResolvedValueOnce(1);
    sorobanService.getTransaction.mockResolvedValueOnce({ status: 'SUCCESS' });

    const result = await service.listCompanyTransactions('company-1', {
      page: 1,
      limit: 20,
    } as any);

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].onChain).toEqual({ status: 'SUCCESS' });
  });
});
