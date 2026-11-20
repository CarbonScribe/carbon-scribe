import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { RedisService } from './redis.service';

class RedisServiceMock {
  private store = new Map<string, string>();
  getClient() {
    return {
      get: async (key: string) => this.store.get(key) ?? null,
      set: async (
        key: string,
        value: string,
        ...args: (string | number)[]
      ) => {
        const nx = args.includes('NX');
        if (nx && this.store.has(key)) {
          return null;
        }
        this.store.set(key, value);
        return 'OK';
      },
      setex: async (key: string, _ttl: number, value: string) => {
        this.store.set(key, value);
      },
      sadd: async () => {},
      smembers: async () => [],
      del: async () => {},
      keys: async () => [],
      info: async () => '',
    };
  }
  isHealthy() {
    return true;
  }
}

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: RedisService,
          useClass: RedisServiceMock,
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

  it('should claim a key atomically only once', async () => {
    await expect(service.setNX('test:claim', true, 60)).resolves.toBe(true);
    await expect(service.setNX('test:claim', true, 60)).resolves.toBe(false);
  });
});
