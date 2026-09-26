import { Test, TestingModule } from '@nestjs/testing';
import { StartupValidator } from './startup-validator';
import { ConfigService } from '../config.service';
import { ServiceValidator } from './service-validator';

describe('StartupValidator', () => {
  let startupValidator: StartupValidator;
  let configService: ConfigService;

  const originalEnv = { ...process.env };

  beforeEach(async () => {
    // Pinata/IPFS credentials are read directly from process.env (not ConfigService),
    // so they must be set here for the "all checks pass" scenario to be deterministic.
    process.env.PINATA_API_KEY = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
    process.env.PINATA_SECRET_KEY = 'z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4';
    process.env.PINATA_JWT = 'eyJhbGciOiJIUzI1NiJ9.mock-payload.mock-signature';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartupValidator,
        {
          provide: ConfigService,
          useValue: {
            getAppConfig: jest.fn().mockReturnValue({
              nodeEnv: 'production',
              port: 3000,
            }),
            getDatabaseConfig: jest.fn().mockReturnValue({
              url: 'postgresql://user:pass@localhost:5432/db',
            }),
            getRedisConfig: jest.fn().mockReturnValue({
              host: 'localhost',
              port: 6379,
            }),
            getKafkaConfig: jest.fn().mockReturnValue({
              brokers: ['localhost:9092'],
            }),
            getStellarConfig: jest.fn().mockReturnValue({
              network: 'mainnet',
              horizonUrl: 'https://horizon.stellar.org',
              sorobanRpcUrl: 'https://soroban.stellar.org',
            }),
            getAuthConfig: jest.fn().mockReturnValue({
              jwtSecret: 'secure-jwt-secret-with-32-chars-min!',
            }),
            getServicesConfig: jest.fn().mockReturnValue({
              ipfsGateway: 'https://gateway.pinata.cloud/ipfs/',
            }),
          },
        },
        {
          provide: ServiceValidator,
          useValue: {
            validateAllServices: jest.fn().mockResolvedValue([
              { service: 'Database', connected: true, latencyMs: 10 },
              { service: 'Redis', connected: true, latencyMs: 5 },
              { service: 'Kafka', connected: true, latencyMs: 20 },
              { service: 'Stellar', connected: true, latencyMs: 50 },
              { service: 'IPFS', connected: true, latencyMs: 30 },
            ]),
          },
        },
      ],
    }).compile();

    startupValidator = module.get<StartupValidator>(StartupValidator);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should be defined', () => {
    expect(startupValidator).toBeDefined();
  });

  describe('validateStartup', () => {
    it('should return valid result when all checks pass', async () => {
      const result = await startupValidator.validateStartup();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.connectivity).toHaveLength(5);
    });

    it('should return errors when validation fails', async () => {
      jest.spyOn(configService, 'getDatabaseConfig').mockReturnValue({
        url: '',
        poolSize: 10,
      });

      const result = await startupValidator.validateStartup();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should include connectivity results', async () => {
      const result = await startupValidator.validateStartup();
      expect(result.connectivity).toBeDefined();
      expect(result.connectivity.length).toBeGreaterThan(0);
    });
  });
});
