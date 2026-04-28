import { EventLoggerService } from './event-logger.service';

describe('EventLoggerService', () => {
  const createService = () => {
    const tx = {
      auditEvent: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (callback: (trx: typeof tx) => unknown) =>
        callback(tx),
      ),
    };

    return {
      service: new EventLoggerService(prisma as any),
      prisma,
      tx,
    };
  };

  it('produces consistent hashes for identical payloads', () => {
    const { service } = createService();
    const payload = {
      companyId: 'company-1',
      userId: 'user-1',
      eventType: 'RETIREMENT',
      action: 'CREATE',
      entityType: 'Retirement',
      entityId: 'ret-1',
      metadata: { a: 1, b: 2 },
      previousHash: 'GENESIS',
      timestamp: '2026-03-29T00:00:00.000Z',
    };

    const hash1 = service.calculateHash(payload);
    const hash2 = service.calculateHash(payload);

    expect(hash1).toBe(hash2);
  });

  it('produces unique hashes for different payloads', () => {
    const { service } = createService();

    const hash1 = service.calculateHash({
      companyId: 'company-1',
      entityId: 'ret-1',
      timestamp: '2026-03-29T00:00:00.000Z',
    });

    const hash2 = service.calculateHash({
      companyId: 'company-1',
      entityId: 'ret-2',
      timestamp: '2026-03-29T00:00:00.000Z',
    });

    expect(hash1).not.toBe(hash2);
  });

  it('maintains hash chain by linking to previous hash', async () => {
    const { service, tx } = createService();

    tx.auditEvent.findFirst.mockResolvedValue({ hash: 'previous-hash' });
    tx.auditEvent.create.mockImplementation(async (args: any) => ({
      id: 'event-1',
      ...args.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const event = await service.recordEvent({
      companyId: 'company-1',
      userId: 'user-1',
      eventType: 'RETIREMENT',
      action: 'CREATE',
      entityType: 'Retirement',
      entityId: 'ret-1',
      metadata: { ipAddress: '127.0.0.1' },
    });

    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          previousHash: 'previous-hash',
          hash: expect.any(String),
        }),
      }),
    );
    expect(event.previousHash).toBe('previous-hash');
  });

  it('serializes nested objects deterministically', () => {
    const { service } = createService();

    const stateA = {
      nested: {
        y: 2,
        x: 1,
      },
      z: [
        {
          b: 2,
          a: 1,
        },
      ],
    };

    const stateB = {
      z: [
        {
          a: 1,
          b: 2,
        },
      ],
      nested: {
        x: 1,
        y: 2,
      },
    };

    expect(service.serializeState(stateA)).toEqual(
      service.serializeState(stateB),
    );
  });
});
