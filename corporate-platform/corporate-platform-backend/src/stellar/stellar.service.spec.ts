import { Test, TestingModule } from '@nestjs/testing';
import { StellarService } from './stellar.service';
import { ConfigService } from '../config/config.service';
import { WalletService } from './services/wallet.service';
import { BalanceService } from './services/balance.service';
import { KeyManagementService } from './services/key-management.service';

describe('StellarService', () => {
  let service: StellarService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarService,
        {
          provide: ConfigService,
          useValue: {
            getStellarConfig: jest.fn().mockReturnValue({
              network: 'testnet',
              horizonUrl: 'https://horizon-testnet.stellar.org',
              sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
              networkPassphrase: 'Test SDF Network ; September 2015',
              carbonAssetContractId: 'CAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM',
            }),
          },
        },
        {
          provide: WalletService,
          useValue: {
            createWallet: jest.fn(),
            getWallet: jest.fn(),
            updateWalletStatus: jest.fn(),
            recordTransaction: jest.fn(),
            getTransactions: jest.fn(),
            isWalletActive: jest.fn(),
          },
        },
        {
          provide: BalanceService,
          useValue: {
            getBalances: jest.fn(),
            getXlmBalance: jest.fn(),
            healthCheck: jest.fn(),
          },
        },
        {
          provide: KeyManagementService,
          useValue: {
            generateKeypair: jest.fn(),
            encryptPrivateKey: jest.fn(),
            decryptPrivateKey: jest.fn(),
            validatePublicKey: jest.fn(),
            validateSecretKey: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StellarService>(StellarService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
