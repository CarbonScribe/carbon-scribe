import { Test, TestingModule } from '@nestjs/testing';
import { BalanceService } from './balance.service';
import { ConfigService } from '../../config/config.service';
import { WalletService } from './wallet.service';

describe('BalanceService', () => {
  let service: BalanceService;
  let configService: jest.Mocked<ConfigService>;
  let walletService: jest.Mocked<WalletService>;

  beforeEach(async () => {
    const mockConfig = {
      getStellarConfig: jest.fn().mockReturnValue({
        network: 'testnet',
        horizonUrl: 'https://horizon-testnet.stellar.org',
        sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
        networkPassphrase: 'Test SDF Network ; September 2015',
        carbonAssetContractId: 'CAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM',
      }),
    };

    const mockWallet = {
      getPublicKey: jest.fn().mockResolvedValue('GCKPKAV5V6VNZLZJ7U3DBYTG7P7P2DZFKDDI7IMVYXEX3H5HNYP3WBK7'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        {
          provide: ConfigService,
          useValue: mockConfig,
        },
        {
          provide: WalletService,
          useValue: mockWallet,
        },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
    walletService = module.get(WalletService) as jest.Mocked<WalletService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getXlmBalance', () => {
    it('should return XLM balance', async () => {
      // Mock the Horizon server call
      const mockLoadAccount = jest.fn().mockResolvedValue({
        balances: [
          { asset_type: 'native', balance: '1000.0000000' },
        ],
      });
      (service as any).horizon = { loadAccount: mockLoadAccount };

      const result = await service.getXlmBalance('company-1');

      expect(result).toBe('1000.0000000');
      expect(walletService.getPublicKey).toHaveBeenCalledWith('company-1');
    });

    it('should return 0 for unfunded account', async () => {
      const mockLoadAccount = jest.fn().mockRejectedValue({
        response: { status: 404 },
      });
      (service as any).horizon = { loadAccount: mockLoadAccount };

      const result = await service.getXlmBalance('company-1');

      expect(result).toBe('0');
    });
  });

  describe('getBalances', () => {
    it('should return XLM and carbon credit balances', async () => {
      const mockLoadAccount = jest.fn().mockResolvedValue({
        balances: [
          { asset_type: 'native', balance: '1000.0000000' },
        ],
      });
      (service as any).horizon = { loadAccount: mockLoadAccount };

      // Mock getCarbonCreditBalances to return empty array
      jest.spyOn(service as any, 'getCarbonCreditBalances').mockResolvedValue([]);

      const result = await service.getBalances('company-1');

      expect(result.xlm.balance).toBe('1000.0000000');
      expect(result.xlm.assetType).toBe('native');
      expect(result.carbonCredits).toEqual([]);
    });

    it('should return zero balances for unfunded account', async () => {
      const mockLoadAccount = jest.fn().mockRejectedValue({
        response: { status: 404 },
      });
      (service as any).horizon = { loadAccount: mockLoadAccount };

      const result = await service.getBalances('company-1');

      expect(result.xlm.balance).toBe('0');
      expect(result.carbonCredits).toEqual([]);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const mockRoot = jest.fn().mockResolvedValue({});
      const mockGetHealth = jest.fn().mockResolvedValue({});
      (service as any).horizon = { root: mockRoot };
      (service as any).rpc = { getHealth: mockGetHealth };

      const result = await service.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.network).toBe('testnet');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status on error', async () => {
      const mockRoot = jest.fn().mockRejectedValue(new Error('Connection failed'));
      (service as any).horizon = { root: mockRoot };

      const result = await service.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Connection failed');
    });
  });
});
