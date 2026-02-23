import { BatchService } from './batch.service';

describe('BatchService', () => {
  let service: BatchService;
  let prisma: any;
  let validationService: any;

  beforeEach(() => {
    prisma = {
      batchRetirement: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
      credit: { update: jest.fn() },
      retirement: { create: jest.fn() },
    };

    validationService = {
      validateRetirement: jest.fn(),
    };

    service = new BatchService(prisma, validationService);
  });

  it('handles partial failure during batch processing', async () => {
    prisma.batchRetirement.findUnique.mockResolvedValue({
      id: 'b1',
      name: 'Batch 1',
      companyId: 'c1',
      createdBy: 'u1',
      items: [
        { creditId: 'cr1', amount: 10, purpose: 'scope1' },
        { creditId: 'cr2', amount: 20, purpose: 'scope2' },
      ],
    });

    validationService.validateRetirement
      .mockResolvedValueOnce({ valid: true })
      .mockRejectedValueOnce(new Error('Insufficient credits'));

    prisma.$transaction.mockImplementation(async (fn: any) =>
      fn({
        credit: { update: jest.fn() },
        retirement: { create: jest.fn().mockResolvedValue({ id: 'ret-1' }) },
      }),
    );

    const result = await service.processBatch('b1');

    expect(result.totalItems).toBe(2);
    expect(result.completedItems).toBe(1);
    expect(result.failedItems).toBe(1);
    expect(result.retirementIds).toEqual(['ret-1']);
    expect(result.errors[0].error).toContain('Insufficient credits');
  });
});
