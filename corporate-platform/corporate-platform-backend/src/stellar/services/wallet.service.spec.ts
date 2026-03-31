import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { KeyManagementService } from './key-management.service';
import {
  WalletStatus,
  TransactionStatus,
  OperationType,
} from '../interfaces/stellar.interface';

describe('WalletService', () => {
  let service: WalletService;
  let keyManagementService: any;

  beforeEach(async () => {
    keyManagementService = {
      generateKeypair: jest.fn().mockReturnValue({
        publicKey: 'GCKPKAV5V6VNZLZJ7U3DBYTG7P7P2DZFKDDI7IMVYXEX3H5HNYP3WBK7',
        secret: 'SBJGKHLIKSSTPTQCTQBKW5LZSWYOIRMXKCVB7JABHQWDGKWYV3PTJMVH',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: PrismaService,
          useValue: {}, // Mock PrismaService since we're not using database operations
        },
        {
          provide: KeyManagementService,
          useValue: keyManagementService,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWallet', () => {
    it('should create a new mock wallet', async () => {
      const result = await service.createWallet({ companyId: 'company-1' });

      expect(result).toHaveProperty('id');
      expect(result.companyId).toBe('company-1');
      expect(result.publicKey).toBe(
        'GCKPKAV5V6VNZLZJ7U3DBYTG7P7P2DZFKDDI7IMVYXEX3H5HNYP3WBK7',
      );
      expect(result.status).toBe(WalletStatus.ACTIVE);
      expect(result.id).toBe('mock-wallet-company-1');
    });

    it('should create wallet with different company ID', async () => {
      const result = await service.createWallet({ companyId: 'company-2' });

      expect(result.companyId).toBe('company-2');
      expect(result.id).toBe('mock-wallet-company-2');
    });
  });

  describe('getWalletByCompanyId', () => {
    it('should return mock wallet by company ID', async () => {
      const result = await service.getWalletByCompanyId('company-1');

      expect(result.id).toBe('mock-wallet-company-1');
      expect(result.companyId).toBe('company-1');
      expect(result.publicKey).toBe('GMOCKPUBLICKEY123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      expect(result.status).toBe(WalletStatus.ACTIVE);
    });

    it('should return mock wallet for unknown company', async () => {
      const result = await service.getWalletByCompanyId('unknown-company');

      expect(result.id).toBe('mock-wallet-unknown-company');
      expect(result.companyId).toBe('unknown-company');
    });
  });

  describe('getWalletByPublicKey', () => {
    it('should return mock wallet by public key', async () => {
      const publicKey = 'GTESTPUBLICKEY123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const result = await service.getWalletByPublicKey(publicKey);

      expect(result.publicKey).toBe(publicKey);
      expect(result.status).toBe(WalletStatus.ACTIVE);
      expect(result.id).toBe('mock-wallet-id');
    });
  });

  describe('updateWalletStatus', () => {
    it('should update mock wallet status', async () => {
      const result = await service.updateWalletStatus(
        'company-1',
        WalletStatus.LOCKED,
      );

      expect(result.status).toBe(WalletStatus.LOCKED);
      expect(result.companyId).toBe('company-1');
    });

    it('should update to active status', async () => {
      const result = await service.updateWalletStatus(
        'company-1',
        WalletStatus.ACTIVE,
      );

      expect(result.status).toBe(WalletStatus.ACTIVE);
    });
  });

  describe('isWalletActive', () => {
    it('should return true for any wallet (mock behavior)', async () => {
      const result = await service.isWalletActive('company-1');
      expect(result).toBe(true);
    });

    it('should return true for unknown company (mock behavior)', async () => {
      const result = await service.isWalletActive('unknown-company');
      expect(result).toBe(true);
    });
  });

  describe('getSecretKey', () => {
    it('should return mock secret key', async () => {
      const result = await service.getSecretKey('company-1');

      expect(result).toBe('mock-secret-key-for-testing-only');
    });

    it('should return mock secret key for any company', async () => {
      const result = await service.getSecretKey('any-company');
      expect(result).toBe('mock-secret-key-for-testing-only');
    });
  });

  describe('getPublicKey', () => {
    it('should return mock public key', async () => {
      const result = await service.getPublicKey('company-1');

      expect(result).toBe('GMOCKPUBLICKEY123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    });

    it('should return different mock public key for different company', async () => {
      const result = await service.getPublicKey('company-2');

      expect(result).toBe('GMOCKPUBLICKEY123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    });
  });

  describe('recordTransaction', () => {
    it('should record a mock transaction', async () => {
      const result = await service.recordTransaction({
        companyId: 'company-1',
        walletId: 'wallet-1',
        transactionHash: 'abc123',
        operationType: OperationType.TRANSFER,
        amount: 100,
        tokenIds: [1, 2, 3],
      });

      expect(result.transactionHash).toBe('abc123');
      expect(result.status).toBe(TransactionStatus.PENDING);
      expect(result.companyId).toBe('company-1');
      expect(result.walletId).toBe('wallet-1');
      expect(result.amount).toBe(100);
      expect(result.tokenIds).toEqual([1, 2, 3]);
      expect(result.id).toMatch(/^mock-tx-\d+$/);
    });
  });

  describe('updateTransactionStatus', () => {
    it('should update mock transaction status', async () => {
      const result = await service.updateTransactionStatus(
        'abc123',
        TransactionStatus.SUCCESS,
        new Date(),
      );

      expect(result.transactionHash).toBe('abc123');
      expect(result.status).toBe(TransactionStatus.SUCCESS);
      expect(result.confirmedAt).toBeInstanceOf(Date);
    });

    it('should update to failed status', async () => {
      const result = await service.updateTransactionStatus(
        'abc123',
        TransactionStatus.FAILED,
      );

      expect(result.status).toBe(TransactionStatus.FAILED);
      expect(result.confirmedAt).toBeUndefined();
    });
  });

  describe('getTransactions', () => {
    it('should return empty array (mock behavior)', async () => {
      const result = await service.getTransactions('company-1');

      expect(result).toEqual([]);
    });

    it('should return empty array for any company', async () => {
      const result = await service.getTransactions('any-company');

      expect(result).toEqual([]);
    });
  });
});
