import { AuditLog } from './audit-log.decorator';

describe('AuditLog decorator', () => {
  it('captures method args and result for logging payload', async () => {
    const recorder = jest.fn().mockResolvedValue(undefined);

    class TestService {
      auditTrailService = {
        recordDecoratedAuditEvent: recorder,
      };

      @AuditLog({
        eventType: 'RETIREMENT',
        action: 'CREATE',
        entityType: 'Retirement',
        entityId: (_args, result) => (result as { id: string }).id,
        metadata: (args) => ({
          input: args[0],
        }),
      })
      async createItem(
        payload: { id: string; amount: number },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _user?: { companyId: string; sub: string },
      ) {
        return {
          id: payload.id,
          amount: payload.amount,
        };
      }
    }

    const instance = new TestService();

    await instance.createItem(
      { id: 'ret-1', amount: 100 },
      { companyId: 'company-1', sub: 'user-1' },
    );

    expect(recorder).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'RETIREMENT',
        action: 'CREATE',
        entityType: 'Retirement',
        entityId: 'ret-1',
        companyId: 'company-1',
        userId: 'user-1',
        metadata: {
          input: { id: 'ret-1', amount: 100 },
        },
      }),
    );
  });
});
