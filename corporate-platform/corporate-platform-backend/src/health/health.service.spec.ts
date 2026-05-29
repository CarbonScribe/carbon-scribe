import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../shared/database/prisma.service';
import { RedisService } from '../cache/redis.service';
import { KafkaService } from '../event-bus/kafka.service';
import { IpfsConfig } from '../ipfs/ipfs.config';
import { SorobanService } from '../stellar/soroban/soroban.service';
import axios from 'axios';

// Declare Jest globals to satisfy the TypeScript compiler when node_modules is not locally installed
declare const jest: any;
declare const describe: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const it: any;
declare const expect: any;

jest.mock('axios');
const mockedAxios = axios as any;

describe('HealthService', () => {
  let service: HealthService;
  let prismaService: jest.Mocked<PrismaService>;
  let kafkaService: jest.Mocked<KafkaService>;

  const mockRedisClient = {
    ping: jest.fn(),
  };

  const mockRpcClient = {
    getLatestLedger: jest.fn(),
  };

  const mockFetchTopicMetadata = jest.fn();

  const mockKafkaAdmin = {
    fetchTopicMetadata: mockFetchTopicMetadata,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockRedisClient),
            isHealthy: jest.fn(),
          },
        },
        {
          provide: KafkaService,
          useValue: {
            isEnabled: jest.fn().mockReturnValue(true),
            getAdmin: jest.fn().mockReturnValue(mockKafkaAdmin),
          },
        },
        {
          provide: IpfsConfig,
          useValue: {
            jwt: 'mock-jwt',
          },
        },
        {
          provide: SorobanService,
          useValue: {
            getRpcClient: jest.fn().mockReturnValue(mockRpcClient),
          },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    prismaService = module.get(PrismaService) as any;
    kafkaService = module.get(KafkaService) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getReadiness', () => {
    it('should return status healthy if all dependencies are healthy', async () => {
      // Mock DB: success
      prismaService.$queryRaw.mockResolvedValue([1]);

      // Mock Redis: success
      mockRedisClient.ping.mockResolvedValue('PONG');

      // Mock Kafka: success
      mockFetchTopicMetadata.mockResolvedValue({ topics: [] });

      // Mock IPFS: success
      mockedAxios.get.mockResolvedValue({ status: 200, data: {} });

      // Mock Stellar: success
      mockRpcClient.getLatestLedger.mockResolvedValue({ sequence: 100 });

      const readiness = await service.getReadiness();

      expect(readiness.status).toBe('healthy');
      expect(readiness.checks.database.status).toBe('healthy');
      expect(readiness.checks.redis.status).toBe('healthy');
      expect(readiness.checks.kafka.status).toBe('healthy');
      expect(readiness.checks.ipfs.status).toBe('healthy');
      expect(readiness.checks.stellar.status).toBe('healthy');
    });

    it('should return unhealthy if database check fails', async () => {
      prismaService.$queryRaw.mockRejectedValue(new Error('Connection error'));
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockFetchTopicMetadata.mockResolvedValue({ topics: [] });
      mockedAxios.get.mockResolvedValue({ status: 200, data: {} });
      mockRpcClient.getLatestLedger.mockResolvedValue({ sequence: 100 });

      const readiness = await service.getReadiness();

      expect(readiness.status).toBe('unhealthy');
      expect(readiness.checks.database.status).toBe('unhealthy');
      expect(readiness.checks.database.error).toBe('Connection error');
    });

    it('should return healthy if Kafka is disabled and all others are healthy', async () => {
      kafkaService.isEnabled.mockReturnValue(false);
      prismaService.$queryRaw.mockResolvedValue([1]);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockedAxios.get.mockResolvedValue({ status: 200, data: {} });
      mockRpcClient.getLatestLedger.mockResolvedValue({ sequence: 100 });

      const readiness = await service.getReadiness();

      expect(readiness.status).toBe('healthy');
      expect(readiness.checks.kafka.status).toBe('disabled');
    });

    it('should treat IPFS 401/403 status as healthy (reachable)', async () => {
      prismaService.$queryRaw.mockResolvedValue([1]);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockFetchTopicMetadata.mockResolvedValue({ topics: [] });
      mockRpcClient.getLatestLedger.mockResolvedValue({ sequence: 100 });

      // Mock IPFS returning a 401 response error
      const error401 = {
        response: { status: 401, data: 'Unauthorized' },
        message: 'Request failed with status code 401',
      };
      mockedAxios.get.mockRejectedValue(error401);

      const readiness = await service.getReadiness();

      expect(readiness.status).toBe('healthy');
      expect(readiness.checks.ipfs.status).toBe('healthy');
      expect(readiness.checks.ipfs.details).toContain('Reachable (HTTP Status: 401)');
    });
  });
});
