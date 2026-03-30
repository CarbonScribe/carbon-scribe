import { IntegrityVerifierService } from './integrity-verifier.service';

describe('IntegrityVerifierService', () => {
  const setup = () => {
    const prisma = {
      auditEvent: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const eventLogger = {
      recalculateHash: jest.fn(),
    };

    const service = new IntegrityVerifierService(
      prisma as any,
      eventLogger as any,
    );

    return {
      service,
      prisma,
      eventLogger,
    };
  };

  it('flags tampered record when recomputed hash does not match', async () => {
    const { service, prisma, eventLogger } = setup();
    const timestamp = new Date('2026-03-29T00:00:00.000Z');

    prisma.auditEvent.findFirst
      .mockResolvedValueOnce({
        id: 'evt-1',
        companyId: 'company-1',
        userId: 'user-1',
        eventType: 'RETIREMENT',
        action: 'CREATE',
        entityType: 'Retirement',
        entityId: 'ret-1',
        previousState: null,
        newState: { id: 'ret-1' },
        metadata: {},
        previousHash: 'GENESIS',
        hash: 'stored-hash',
        transactionHash: null,
        blockNumber: null,
        timestamp,
        createdAt: timestamp,
      })
      .mockResolvedValueOnce(null);

    eventLogger.recalculateHash.mockReturnValue('different-hash');

    const result = await service.verifyEvent('company-1', 'evt-1');

    expect(result.valid).toBe(false);
    expect(result.proof.hashValid).toBe(false);
  });

  it('detects broken links in chain verification', async () => {
    const { service, prisma, eventLogger } = setup();

    prisma.auditEvent.findMany.mockResolvedValue([
      {
        id: 'evt-1',
        previousHash: 'GENESIS',
        hash: 'hash-1',
      },
      {
        id: 'evt-2',
        previousHash: 'broken-link',
        hash: 'hash-2',
      },
    ]);

    eventLogger.recalculateHash
      .mockReturnValueOnce('hash-1')
      .mockReturnValueOnce('hash-2');

    const result = await service.verifyChain('company-1');

    expect(result.valid).toBe(false);
    expect(result.brokenLinks).toEqual(['evt-2']);
  });
});
