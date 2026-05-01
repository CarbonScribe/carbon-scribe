import { NotFoundException } from '@nestjs/common';
import { RetirementAuditHashService } from './retirement-audit-hash.service';
import { RETIREMENT_TRACKER_CONTRACT_ID } from '../../stellar/soroban/contracts/contract.interface';

// ─────────────────────────────────────────────────────────────────────────────
// Test factory
// ─────────────────────────────────────────────────────────────────────────────

const buildService = (overrides?: {
  prismaAnchor?: Partial<{
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  }>;
  trackerInvoke?: jest.Mock;
  trackerGetRecord?: jest.Mock;
  loggerRecord?: jest.Mock;
}) => {
  const now = new Date('2026-04-25T12:00:00.000Z');

  const defaultAnchor = {
    id: 'anchor-1',
    companyId: 'company-1',
    tokenId: 42,
    auditEventId: null,
    auditHash: '', // filled per test
    contractId: RETIREMENT_TRACKER_CONTRACT_ID,
    onChainTxHash: null,
    anchorStatus: 'PENDING',
    anchoredAt: now,
    verifiedAt: null,
    metadata: null,
  };

  const prisma = {
    retirementAuditHashAnchor: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({
        ...defaultAnchor,
        ...data,
        id: 'anchor-1',
        anchoredAt: now,
      })),
      update: jest.fn().mockImplementation(async ({ data, where }: any) => ({
        ...defaultAnchor,
        id: where.id ?? 'anchor-1',
        ...data,
        anchoredAt: now,
      })),
      ...overrides?.prismaAnchor,
    },
  };

  const retirementTracker = {
    invoke:
      overrides?.trackerInvoke ??
      jest.fn().mockResolvedValue({
        transactionHash: 'tx_abc123',
        status: 'CONFIRMED',
      }),
    getRetirementRecord:
      overrides?.trackerGetRecord ??
      jest.fn().mockResolvedValue({
        token_id: 42,
        retiring_entity: 'GABC...',
        timestamp: 1714040400,
      }),
  };

  const eventLogger = {
    recordEvent: overrides?.loggerRecord ?? jest.fn().mockResolvedValue({}),
  };

  const service = new RetirementAuditHashService(
    prisma as any,
    retirementTracker as any,
    eventLogger as any,
  );

  return {
    service,
    prisma,
    retirementTracker,
    eventLogger,
    defaultAnchor,
    now,
  };
};

const baseInput = {
  tokenId: 42,
  auditRecord: { amount: 10, purpose: 'scope2', companyId: 'company-1' },
  companyId: 'company-1',
  userId: 'user-1',
};

// ─────────────────────────────────────────────────────────────────────────────
// Hashing — deterministic serialization
// ─────────────────────────────────────────────────────────────────────────────

describe('RetirementAuditHashService — deterministic hashing', () => {
  it('produces the same SHA-256 hash for identical records regardless of key insertion order', () => {
    const { service } = buildService();

    const h1 = service.computeAuditHash({ a: 1, b: { y: 2, x: 1 }, c: [1, 2] });
    const h2 = service.computeAuditHash({ c: [1, 2], b: { x: 1, y: 2 }, a: 1 });

    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64); // SHA-256 hex
  });

  it('produces different hashes for different records', () => {
    const { service } = buildService();

    const h1 = service.computeAuditHash({ tokenId: 1, purpose: 'scope2' });
    const h2 = service.computeAuditHash({ tokenId: 2, purpose: 'scope2' });

    expect(h1).not.toBe(h2);
  });

  it('handles nested arrays and null values deterministically', () => {
    const { service } = buildService();
    const record = {
      items: [
        { b: null, a: 1 },
        { b: 2, a: null },
      ],
    };

    const h1 = service.computeAuditHash(record);
    const h2 = service.computeAuditHash(record);

    expect(h1).toBe(h2);
  });

  it('treats Date objects as ISO strings for stable serialization', () => {
    const { service } = buildService();
    const d = new Date('2026-01-01T00:00:00.000Z');

    const h1 = service.computeAuditHash({ ts: d });
    const h2 = service.computeAuditHash({ ts: '2026-01-01T00:00:00.000Z' });

    expect(h1).toBe(h2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// anchorHash — happy path
// ─────────────────────────────────────────────────────────────────────────────

describe('RetirementAuditHashService — anchorHash (happy path)', () => {
  it('creates a DB anchor record with PENDING status before invoking the contract', async () => {
    const { service, prisma } = buildService();

    await service.anchorHash(baseInput);

    expect(prisma.retirementAuditHashAnchor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tokenId: 42,
          companyId: 'company-1',
          anchorStatus: 'PENDING',
          contractId: RETIREMENT_TRACKER_CONTRACT_ID,
        }),
      }),
    );
  });

  it('invokes RetirementTrackerService with anchor_audit_hash method and correct args', async () => {
    const { service, retirementTracker } = buildService();

    const expectedHash = service.computeAuditHash(baseInput.auditRecord);
    await service.anchorHash(baseInput);

    expect(retirementTracker.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        methodName: 'anchor_audit_hash',
        args: [
          { type: 'u32', value: 42 },
          { type: 'string', value: expectedHash },
        ],
      }),
    );
  });

  it('updates the anchor record with the on-chain tx hash and CONFIRMED status', async () => {
    const { service, prisma } = buildService();

    const result = await service.anchorHash(baseInput);

    expect(prisma.retirementAuditHashAnchor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onChainTxHash: 'tx_abc123',
          anchorStatus: 'CONFIRMED',
        }),
      }),
    );
    expect(result.onChainTxHash).toBe('tx_abc123');
    expect(result.anchorStatus).toBe('CONFIRMED');
    expect(result.idempotent).toBe(false);
  });

  it('records a companion AuditEvent after successful anchoring', async () => {
    const { service, eventLogger } = buildService();

    await service.anchorHash(baseInput);

    expect(eventLogger.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'RetirementAuditHashAnchor',
        entityId: '42',
        eventType: 'RETIREMENT',
        action: 'CREATE',
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// anchorHash — idempotency
// ─────────────────────────────────────────────────────────────────────────────

describe('RetirementAuditHashService — anchorHash (idempotency)', () => {
  it('returns existing CONFIRMED anchor without re-invoking contract', async () => {
    const existingHash = new RetirementAuditHashService(
      {} as any,
      {} as any,
      {} as any,
    ).computeAuditHash(baseInput.auditRecord);

    const confirmedAnchor = {
      id: 'existing-anchor',
      tokenId: 42,
      auditHash: existingHash,
      onChainTxHash: 'tx_existing',
      anchorStatus: 'CONFIRMED',
      anchoredAt: new Date(),
    };

    const { service, retirementTracker } = buildService({
      prismaAnchor: {
        findUnique: jest.fn().mockResolvedValue(confirmedAnchor),
      },
    });

    const result = await service.anchorHash(baseInput);

    expect(retirementTracker.invoke).not.toHaveBeenCalled();
    expect(result.idempotent).toBe(true);
    expect(result.anchorId).toBe('existing-anchor');
    expect(result.onChainTxHash).toBe('tx_existing');
  });

  it('retries FAILED anchors by resetting status to PENDING and re-invoking', async () => {
    const svc = new RetirementAuditHashService({} as any, {} as any, {} as any);
    const existingHash = svc.computeAuditHash(baseInput.auditRecord);

    const failedAnchor = {
      id: 'failed-anchor',
      tokenId: 42,
      auditHash: existingHash,
      onChainTxHash: null,
      anchorStatus: 'FAILED',
      anchoredAt: new Date(),
    };

    const updateMock = jest
      .fn()
      .mockResolvedValueOnce({
        ...failedAnchor,
        anchorStatus: 'PENDING',
        onChainTxHash: null,
      })
      .mockResolvedValueOnce({
        ...failedAnchor,
        anchorStatus: 'CONFIRMED',
        onChainTxHash: 'tx_retry',
      });

    const { service, retirementTracker } = buildService({
      prismaAnchor: {
        findUnique: jest.fn().mockResolvedValue(failedAnchor),
        update: updateMock,
      },
    });

    const result = await service.anchorHash(baseInput);

    expect(retirementTracker.invoke).toHaveBeenCalledTimes(1);
    expect(result.anchorStatus).toBe('CONFIRMED');
    expect(result.idempotent).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// anchorHash — partial failure
// ─────────────────────────────────────────────────────────────────────────────

describe('RetirementAuditHashService — anchorHash (partial failure)', () => {
  it('marks anchor as FAILED when Soroban invocation throws', async () => {
    const updateMock = jest.fn().mockImplementation(async ({ data }: any) => ({
      id: 'anchor-1',
      tokenId: 42,
      anchoredAt: new Date(),
      ...data,
    }));

    const { service, prisma, eventLogger } = buildService({
      trackerInvoke: jest.fn().mockRejectedValue(new Error('Network timeout')),
      prismaAnchor: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'anchor-1',
          tokenId: 42,
          auditHash: '',
          anchorStatus: 'PENDING',
          anchoredAt: new Date(),
        }),
        update: updateMock,
      },
    });

    const result = await service.anchorHash(baseInput);

    // DB record must be set to FAILED
    expect(prisma.retirementAuditHashAnchor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          anchorStatus: 'FAILED',
          metadata: expect.objectContaining({ error: 'Network timeout' }),
        }),
      }),
    );

    expect(result.anchorStatus).toBe('FAILED');
    expect(result.onChainTxHash).toBeNull();

    // A companion audit event must still be recorded for the failed attempt
    expect(eventLogger.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'RetirementAuditHashAnchor' }),
    );
  });

  it('does not propagate AuditEvent recording failures', async () => {
    const { service, eventLogger } = buildService({
      loggerRecord: jest.fn().mockRejectedValue(new Error('DB down')),
    });

    // Should not throw even if event logger fails
    await expect(service.anchorHash(baseInput)).resolves.toBeDefined();
    expect(eventLogger.recordEvent).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifyHash
// ─────────────────────────────────────────────────────────────────────────────

describe('RetirementAuditHashService — verifyHash', () => {
  it('returns txProofConfirmed=true for a CONFIRMED anchor with an on-chain tx hash', async () => {
    const confirmedAnchor = {
      id: 'anchor-1',
      tokenId: 42,
      auditHash: 'abc123hash',
      onChainTxHash: 'tx_proof',
      anchorStatus: 'CONFIRMED',
      anchoredAt: new Date(),
      verifiedAt: null,
    };

    const { service } = buildService({
      prismaAnchor: {
        findFirst: jest.fn().mockResolvedValue(confirmedAnchor),
        update: jest
          .fn()
          .mockResolvedValue({ ...confirmedAnchor, verifiedAt: new Date() }),
      },
    });

    const result = await service.verifyHash('company-1', 42);

    expect(result.txProofConfirmed).toBe(true);
    expect(result.auditHash).toBe('abc123hash');
    expect(result.onChainTxHash).toBe('tx_proof');
    expect(result.onChainRecord).not.toBeNull();
  });

  it('returns txProofConfirmed=false for a PENDING anchor', async () => {
    const pendingAnchor = {
      id: 'anchor-2',
      tokenId: 42,
      auditHash: 'pending_hash',
      onChainTxHash: null,
      anchorStatus: 'PENDING',
      anchoredAt: new Date(),
      verifiedAt: null,
    };

    const { service } = buildService({
      prismaAnchor: {
        findFirst: jest.fn().mockResolvedValue(pendingAnchor),
        update: jest.fn().mockResolvedValue(pendingAnchor),
      },
    });

    const result = await service.verifyHash('company-1', 42);

    expect(result.txProofConfirmed).toBe(false);
    expect(result.anchorStatus).toBe('PENDING');
  });

  it('throws NotFoundException when no anchor record exists', async () => {
    const { service } = buildService({
      prismaAnchor: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.verifyHash('company-1', 99)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns onChainRecord=null gracefully when Soroban call fails', async () => {
    const confirmedAnchor = {
      id: 'anchor-3',
      tokenId: 42,
      auditHash: 'xyz_hash',
      onChainTxHash: 'tx_ok',
      anchorStatus: 'CONFIRMED',
      anchoredAt: new Date(),
      verifiedAt: null,
    };

    const { service } = buildService({
      prismaAnchor: {
        findFirst: jest.fn().mockResolvedValue(confirmedAnchor),
        update: jest.fn().mockResolvedValue(confirmedAnchor),
      },
      trackerGetRecord: jest
        .fn()
        .mockRejectedValue(new Error('Soroban RPC down')),
    });

    const result = await service.verifyHash('company-1', 42);

    expect(result.onChainRecord).toBeNull();
    // txProofConfirmed is based on the anchor record status, not the RPC call
    expect(result.txProofConfirmed).toBe(true);
  });

  it('updates verifiedAt timestamp on each verification call', async () => {
    const confirmedAnchor = {
      id: 'anchor-4',
      tokenId: 42,
      auditHash: 'hash',
      onChainTxHash: 'tx_ok',
      anchorStatus: 'CONFIRMED',
      anchoredAt: new Date(),
      verifiedAt: null,
    };

    const updateMock = jest.fn().mockImplementation(async ({ data }: any) => ({
      ...confirmedAnchor,
      ...data,
    }));

    const { service } = buildService({
      prismaAnchor: {
        findFirst: jest.fn().mockResolvedValue(confirmedAnchor),
        update: updateMock,
      },
    });

    const result = await service.verifyHash('company-1', 42);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ verifiedAt: expect.any(Date) }),
      }),
    );
    expect(result.verifiedAt).toBeDefined();
  });
});
