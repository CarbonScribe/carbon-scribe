import { AuditTrailService } from './audit-trail.service';

describe('AuditTrailService integrity metadata', () => {
  it('marks anchored events and reports recomputed hash mismatches', async () => {
    const events = [
      {
        id: 'anchored-event',
        hash: 'valid-hash',
        transactionHash: 'stellar-tx-hash',
      },
      {
        id: 'tampered-event',
        hash: 'stored-hash',
        transactionHash: null,
      },
    ];
    const prisma = {
      auditEvent: {
        findMany: jest.fn().mockResolvedValue(events),
        count: jest.fn().mockResolvedValue(events.length),
      },
    };
    const eventLogger = {
      recalculateHash: jest.fn((event: { hash: string }) =>
        event.hash === 'stored-hash' ? 'recomputed-hash' : event.hash,
      ),
    };
    const service = new AuditTrailService(
      prisma as any,
      eventLogger as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.queryEvents('company-1', {} as any);

    expect(result.events[0]).toMatchObject({
      anchored: true,
      anchorTxHash: 'stellar-tx-hash',
      hashMatch: true,
    });
    expect(result.events[1]).toMatchObject({
      anchored: false,
      anchorTxHash: undefined,
      hashMatch: false,
    });
  });
});