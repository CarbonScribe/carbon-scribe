import { Test, TestingModule } from '@nestjs/testing';
import {
  StartupValidator,
  isValidCorsOrigin,
  isValidContractId,
  detectNetworkFromUrl,
} from './startup-validator';
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
    // CORS_ORIGINS is likewise read directly from process.env (#646) — must
    // be set for the "all checks pass" baseline, since it's now a hard
    // error in production when missing.
    process.env.CORS_ORIGINS = 'https://app.carbonscribe.example';
    // Contract IDs are also read directly from process.env (#647) — must
    // be set, and must be valid Stellar contract addresses, for the "all
    // checks pass" baseline.
    process.env.CARBON_ASSET_CONTRACT_ID =
      'CAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM';
    process.env.RETIREMENT_TRACKER_CONTRACT_ID =
      'CCDCE6N7Q27TZW6Z6W3DPDCNOGHWFSOQUQPSRRZIY7AEHNOYZMNFDFVU';
    process.env.METHODOLOGY_LIBRARY_CONTRACT_ID =
      'CDQXMVTNCAN4KKPFOAMAAKU4B7LNNQI7F6EX2XIGKVNPJPKGWGM35BTP';

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

  // #646
  describe('CORS_ORIGINS validation', () => {
    it('fails startup in production when CORS_ORIGINS is unset', async () => {
      delete process.env.CORS_ORIGINS;

      const result = await startupValidator.validateStartup();

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'CORS_ORIGINS must be explicitly configured in production',
          ),
        ]),
      );
    });

    it('fails startup in production when CORS_ORIGINS is set but empty', async () => {
      process.env.CORS_ORIGINS = '  ,  ,';

      const result = await startupValidator.validateStartup();

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'CORS_ORIGINS must be explicitly configured in production',
          ),
        ]),
      );
    });

    it('fails startup with a specific error naming a malformed origin', async () => {
      process.env.CORS_ORIGINS =
        'https://app.carbonscribe.example,not-a-url,https://admin.carbonscribe.example';

      const result = await startupValidator.validateStartup();

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'CORS_ORIGINS contains an invalid origin: "not-a-url"',
          ),
        ]),
      );
    });

    it('passes when every configured origin is a well-formed http(s) URL', async () => {
      process.env.CORS_ORIGINS =
        'https://app.carbonscribe.example,https://admin.carbonscribe.example';

      const result = await startupValidator.validateStartup();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects a malformed origin even outside production', async () => {
      jest.spyOn(configService, 'getAppConfig').mockReturnValue({
        nodeEnv: 'development',
        port: 3000,
        apiPrefix: 'api/v1',
        serviceName: 'corporate-platform-backend',
      });
      process.env.CORS_ORIGINS =
        'https://valid.example,ftp://wrong-scheme.example';

      const result = await startupValidator.validateStartup();

      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'CORS_ORIGINS contains an invalid origin: "ftp://wrong-scheme.example"',
          ),
        ]),
      );
    });

    it('does not require CORS_ORIGINS outside production', async () => {
      jest.spyOn(configService, 'getAppConfig').mockReturnValue({
        nodeEnv: 'development',
        port: 3000,
        apiPrefix: 'api/v1',
        serviceName: 'corporate-platform-backend',
      });
      delete process.env.CORS_ORIGINS;

      const result = await startupValidator.validateStartup();

      expect(
        result.errors.some((e) =>
          e.includes('CORS_ORIGINS must be explicitly configured'),
        ),
      ).toBe(false);
    });
  });

  // #647
  describe('Stellar network/RPC consistency', () => {
    it('fails startup in production when SOROBAN_RPC_URL points at testnet but STELLAR_NETWORK is mainnet', async () => {
      jest.spyOn(configService, 'getStellarConfig').mockReturnValue({
        network: 'mainnet',
        horizonUrl: 'https://horizon.stellar.org',
        sorobanRpcUrl: 'https://soroban-testnet.stellar.org:443',
        simulateTimeout: 30000,
        sendTimeout: 60000,
        getTransactionTimeout: 10000,
        getEventsTimeout: 15000,
        getLatestLedgerTimeout: 10000,
      });

      const result = await startupValidator.validateStartup();

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'SOROBAN_RPC_URL ("https://soroban-testnet.stellar.org:443") looks like a testnet endpoint, but STELLAR_NETWORK is "mainnet"',
          ),
        ]),
      );
    });

    it('fails startup in production when HORIZON_URL points at mainnet but STELLAR_NETWORK is testnet', async () => {
      jest.spyOn(configService, 'getStellarConfig').mockReturnValue({
        network: 'testnet',
        horizonUrl: 'https://horizon.stellar.org',
        sorobanRpcUrl: 'https://soroban-testnet.stellar.org:443',
        simulateTimeout: 30000,
        sendTimeout: 60000,
        getTransactionTimeout: 10000,
        getEventsTimeout: 15000,
        getLatestLedgerTimeout: 10000,
      });

      const result = await startupValidator.validateStartup();

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'HORIZON_URL ("https://horizon.stellar.org") looks like a public endpoint, but STELLAR_NETWORK is "testnet"',
          ),
        ]),
      );
    });

    it('passes when STELLAR_NETWORK and the RPC/Horizon URLs agree', async () => {
      jest.spyOn(configService, 'getStellarConfig').mockReturnValue({
        network: 'mainnet',
        horizonUrl: 'https://horizon.stellar.org',
        sorobanRpcUrl: 'https://soroban-rpc.mainnet.stellar.org:443',
        simulateTimeout: 30000,
        sendTimeout: 60000,
        getTransactionTimeout: 10000,
        getEventsTimeout: 15000,
        getLatestLedgerTimeout: 10000,
      });

      const result = await startupValidator.validateStartup();

      expect(result.valid).toBe(true);
    });

    it('does not flag an ambiguous third-party RPC hostname', async () => {
      jest.spyOn(configService, 'getStellarConfig').mockReturnValue({
        network: 'mainnet',
        horizonUrl: 'https://my-custom-rpc-provider.example.com',
        sorobanRpcUrl: 'https://my-custom-rpc-provider.example.com',
        simulateTimeout: 30000,
        sendTimeout: 60000,
        getTransactionTimeout: 10000,
        getEventsTimeout: 15000,
        getLatestLedgerTimeout: 10000,
      });

      const result = await startupValidator.validateStartup();

      expect(result.errors.some((e) => e.includes('looks like a'))).toBe(false);
    });

    it('only warns (non-fatal) about a network mismatch outside production', async () => {
      jest.spyOn(configService, 'getAppConfig').mockReturnValue({
        nodeEnv: 'development',
        port: 3000,
        apiPrefix: 'api/v1',
        serviceName: 'corporate-platform-backend',
      });
      jest.spyOn(configService, 'getStellarConfig').mockReturnValue({
        network: 'mainnet',
        horizonUrl: 'https://horizon.stellar.org',
        sorobanRpcUrl: 'https://soroban-testnet.stellar.org:443',
        simulateTimeout: 30000,
        sendTimeout: 60000,
        getTransactionTimeout: 10000,
        getEventsTimeout: 15000,
        getLatestLedgerTimeout: 10000,
      });

      const result = await startupValidator.validateStartup();

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('looks like a testnet endpoint'),
        ]),
      );
    });
  });

  // #647
  describe('Contract address validation', () => {
    it('fails startup in production when a contract ID env var is unset', async () => {
      delete process.env.CARBON_ASSET_CONTRACT_ID;

      const result = await startupValidator.validateStartup();

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'CARBON_ASSET_CONTRACT_ID must be explicitly configured in production',
          ),
        ]),
      );
    });

    it('fails startup with a specific error naming a malformed contract ID', async () => {
      process.env.RETIREMENT_TRACKER_CONTRACT_ID = 'not-a-contract-address';

      const result = await startupValidator.validateStartup();

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'RETIREMENT_TRACKER_CONTRACT_ID is not a valid Stellar contract address: "not-a-contract-address"',
          ),
        ]),
      );
    });

    it('passes when every contract ID is a valid Stellar contract address', async () => {
      const result = await startupValidator.validateStartup();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('only warns (non-fatal) about an unset contract ID outside production', async () => {
      jest.spyOn(configService, 'getAppConfig').mockReturnValue({
        nodeEnv: 'development',
        port: 3000,
        apiPrefix: 'api/v1',
        serviceName: 'corporate-platform-backend',
      });
      delete process.env.METHODOLOGY_LIBRARY_CONTRACT_ID;

      const result = await startupValidator.validateStartup();

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'METHODOLOGY_LIBRARY_CONTRACT_ID not configured',
          ),
        ]),
      );
    });

    it('rejects a malformed contract ID even outside production', async () => {
      jest.spyOn(configService, 'getAppConfig').mockReturnValue({
        nodeEnv: 'development',
        port: 3000,
        apiPrefix: 'api/v1',
        serviceName: 'corporate-platform-backend',
      });
      process.env.CARBON_ASSET_CONTRACT_ID =
        'GAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM';

      const result = await startupValidator.validateStartup();

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'CARBON_ASSET_CONTRACT_ID is not a valid Stellar contract address',
          ),
        ]),
      );
    });
  });
});

describe('isValidCorsOrigin', () => {
  it.each([
    'https://example.com',
    'http://example.com',
    'https://sub.example.com:8443',
    'http://localhost:3000',
  ])('accepts a well-formed origin: %s', (origin) => {
    expect(isValidCorsOrigin(origin)).toBe(true);
  });

  it.each([
    ['missing scheme', 'example.com'],
    ['wildcard', '*'],
    ['trailing slash', 'https://example.com/'],
    ['path component', 'https://example.com/api'],
    ['query string', 'https://example.com?x=1'],
    ['non-http(s) scheme', 'ftp://example.com'],
    ['empty string', ''],
  ])('rejects an origin with a %s', (_label, origin) => {
    expect(isValidCorsOrigin(origin)).toBe(false);
  });
});

describe('isValidContractId', () => {
  it.each([
    'CAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM',
    'CCDCE6N7Q27TZW6Z6W3DPDCNOGHWFSOQUQPSRRZIY7AEHNOYZMNFDFVU',
  ])('accepts a well-formed contract address: %s', (contractId) => {
    expect(isValidContractId(contractId)).toBe(true);
  });

  it.each([
    ['too short', 'CABC'],
    [
      'wrong prefix (account address)',
      'GAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM',
    ],
    ['empty string', ''],
    ['not StrKey at all', 'not-a-contract-address'],
  ])('rejects a malformed value: %s', (_label, contractId) => {
    expect(isValidContractId(contractId)).toBe(false);
  });
});

describe('detectNetworkFromUrl', () => {
  it.each([
    'https://horizon-testnet.stellar.org',
    'https://soroban-testnet.stellar.org:443',
  ])('detects testnet from: %s', (url) => {
    expect(detectNetworkFromUrl(url)).toBe('testnet');
  });

  it.each([
    'https://horizon.stellar.org',
    'https://soroban-rpc.mainnet.stellar.org:443',
  ])('detects public/mainnet from: %s', (url) => {
    expect(detectNetworkFromUrl(url)).toBe('public');
  });

  it('returns null for an ambiguous third-party hostname', () => {
    expect(
      detectNetworkFromUrl('https://my-rpc-provider.example.com'),
    ).toBeNull();
  });

  it('returns null for an unparseable URL', () => {
    expect(detectNetworkFromUrl('not a url')).toBeNull();
  });
});
