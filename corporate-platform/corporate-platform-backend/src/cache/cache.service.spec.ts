import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { RedisService } from './redis.service';

class RedisServiceMock {
  private store = new Map<string, string>();
  healthy = true;
  lastSetArgs: unknown[] | null = null;

  getClient() {
    return {
      get: async (key: string) => this.store.get(key) ?? null,
      set: async (key: string, value: string, ...args: unknown[]) => {
        this.lastSetArgs = [key, value, ...args];
        const isNx = args.includes('NX');
        if (isNx && this.store.has(key)) {
          return null;
        }
        this.store.set(key, value);
        return 'OK';
      },
      setex: async (key: string, _ttl: number, value: string) => {
        this.store.set(key, value);
        return 'OK';
      },
      sadd: async () => {},
      smembers: async () => [],
      del: async (key: string) => {
        this.store.delete(key);
      },
      keys: async () => [],
      info: async () => '',
    };
  }
  isHealthy() {
    return this.healthy;
  }
}

describe('CacheService', () => {
  let service: CacheService;
  let redisMock: RedisServiceMock;

  beforeEach(async () => {
    redisMock = new RedisServiceMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: RedisService,
          useValue: redisMock,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should set and get values', async () => {
    await service.set('test:key', { value: 1 }, 60);
    const result = await service.get<{ value: number }>('test:key');
    expect(result?.value).toBe(1);
  });

  it('should atomically claim unseen keys via setIfNotExists with EX + NX and reject duplicates', async () => {
    const firstClaim = await service.setIfNotExists('dedup:1', true, 86400);
    const secondClaim = await service.setIfNotExists('dedup:1', true, 86400);

    expect(firstClaim).toBe(true);
    expect(secondClaim).toBe(false);
    expect(redisMock.lastSetArgs?.[0]).toBe('dedup:1');
    expect(redisMock.lastSetArgs?.slice(2)).toEqual(['EX', 86400, 'NX']);

    const stored = await service.get<boolean>('dedup:1');
    expect(stored).toBe(true);
  });

  it('should return undefined from setIfNotExists when Redis is unhealthy', async () => {
    redisMock.healthy = false;
    const claim = await service.setIfNotExists('dedup:offline', true, 86400);
    expect(claim).toBeUndefined();
  });
});
