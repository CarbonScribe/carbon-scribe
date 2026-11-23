import { RedisService } from './redis.service';

describe('RedisService distributed lock (#814)', () => {
  let service: RedisService;
  let client: { set: jest.Mock; eval: jest.Mock };

  beforeEach(() => {
    service = new RedisService({} as any);
    client = { set: jest.fn(), eval: jest.fn() };
    (service as any).client = client;
    (service as any).healthy = true;
  });

  it('acquires with SET NX PX and returns an ownership token', async () => {
    client.set.mockResolvedValue('OK');
    const token = await service.acquireLock('scheduling:runner', 5000);
    expect(token).toEqual(expect.any(String));
    expect(client.set).toHaveBeenCalledWith(
      'scheduling:runner',
      token,
      'PX',
      5000,
      'NX',
    );
  });

  it('returns null when the lock is already held', async () => {
    client.set.mockResolvedValue(null);
    await expect(service.acquireLock('k', 5000)).resolves.toBeNull();
  });

  it('releases via compare-and-delete Lua so only the owner can unlock', async () => {
    client.eval.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    await expect(service.releaseLock('k', 'mine')).resolves.toBe(true);
    await expect(service.releaseLock('k', 'not-mine')).resolves.toBe(false);
    const [script, numKeys, key, token] = client.eval.mock.calls[0];
    expect(script).toContain("redis.call('get', KEYS[1]) == ARGV[1]");
    expect(script).toContain("redis.call('del', KEYS[1])");
    expect([numKeys, key, token]).toEqual([1, 'k', 'mine']);
  });

  it('extends via compare-and-pexpire Lua', async () => {
    client.eval.mockResolvedValue(1);
    await expect(service.extendLock('k', 'mine', 9000)).resolves.toBe(true);
    const [script, , , , ttl] = client.eval.mock.calls[0];
    expect(script).toContain('pexpire');
    expect(ttl).toBe('9000');
  });

  it('throws when Redis is unavailable so callers can degrade explicitly', async () => {
    (service as any).healthy = false;
    await expect(service.acquireLock('k', 1000)).rejects.toThrow(
      'Redis unavailable',
    );
  });
});
