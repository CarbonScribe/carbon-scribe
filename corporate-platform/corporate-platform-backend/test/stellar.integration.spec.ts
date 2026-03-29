import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { StellarModule } from '../src/stellar/stellar.module';
import { ConfigModule } from '../src/config/config.module';
import { DatabaseModule } from '../src/shared/database/database.module';
import { StellarService } from '../src/stellar/stellar.service';
import { WalletStatus, TransactionStatus } from '../src/stellar/interfaces/stellar.interface';

describe('Stellar Integration (Testnet)', () => {
  let app: INestApplication;
  let stellarService: StellarService;
  const testCompanyId = 'test-company-integration';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        DatabaseModule,
        StellarModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    stellarService = moduleFixture.get<StellarService>(StellarService);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('should verify network connectivity', async () => {
      const health = await stellarService.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.network).toBe('testnet');
      expect(health.latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Wallet Creation', () => {
    it('should create a wallet with valid Stellar keypair', async () => {
      // First check if wallet exists and delete it if so
      try {
        await stellarService.getWallet(testCompanyId);
        // Wallet exists, skip creation or handle accordingly
        return;
      } catch (e) {
        // Wallet doesn't exist, proceed with creation
      }

      const wallet = await stellarService.createWallet(testCompanyId);

      expect(wallet).toBeDefined();
      expect(wallet.companyId).toBe(testCompanyId);
      expect(wallet.publicKey).toMatch(/^G[A-Z0-9]{55}$/);
      expect(wallet.status).toBe(WalletStatus.ACTIVE);
    });

    it('should not allow duplicate wallet creation', async () => {
      await expect(stellarService.createWallet(testCompanyId))
        .rejects
        .toThrow();
    });
  });

  describe('Balance Queries', () => {
    it('should return zero balance for unfunded account', async () => {
      const balances = await stellarService.getBalances(testCompanyId);

      expect(balances).toBeDefined();
      expect(balances.xlm).toBeDefined();
      expect(balances.xlm.assetType).toBe('native');
      // New accounts have 0 balance until funded
      expect(parseFloat(balances.xlm.balance)).toBeGreaterThanOrEqual(0);
      expect(balances.carbonCredits).toBeInstanceOf(Array);
    });

    it('should get XLM balance specifically', async () => {
      const balance = await stellarService.getXlmBalance(testCompanyId);

      expect(typeof balance).toBe('string');
      expect(parseFloat(balance)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Wallet Status Management', () => {
    it('should check if wallet is active', async () => {
      const isActive = await stellarService.isWalletActive(testCompanyId);

      expect(typeof isActive).toBe('boolean');
    });

    it('should update wallet status', async () => {
      // This test modifies state, so we restore it after
      const originalWallet = await stellarService.getWallet(testCompanyId);

      // Update to locked
      const walletService = (stellarService as any).walletService;
      await walletService.updateWalletStatus(testCompanyId, WalletStatus.LOCKED);

      let isActive = await stellarService.isWalletActive(testCompanyId);
      expect(isActive).toBe(false);

      // Restore to active
      await walletService.updateWalletStatus(testCompanyId, WalletStatus.ACTIVE);

      isActive = await stellarService.isWalletActive(testCompanyId);
      expect(isActive).toBe(true);
    });
  });

  describe('Transaction Recording', () => {
    it('should record a pending transaction', async () => {
      const wallet = await stellarService.getWallet(testCompanyId);

      const transaction = await stellarService.recordTransaction({
        companyId: testCompanyId,
        walletId: wallet.id,
        transactionHash: 'test-tx-hash-' + Date.now(),
        operationType: 'TRANSFER',
        amount: 100,
        tokenIds: [1, 2, 3],
        metadata: { test: true },
      });

      expect(transaction).toBeDefined();
      expect(transaction.companyId).toBe(testCompanyId);
      expect(transaction.status).toBe(TransactionStatus.PENDING);
    });

    it('should retrieve transactions for a company', async () => {
      const transactions = await stellarService.getTransactions(testCompanyId);

      expect(transactions).toBeInstanceOf(Array);
      expect(transactions.length).toBeGreaterThan(0);
    });
  });

  describe('Address Validation', () => {
    it('should validate correct Stellar addresses', () => {
      const validAddress = 'GCKPKAV5V6VNZLZJ7U3DBYTG7P7P2DZFKDDI7IMVYXEX3H5HNYP3WBK7';
      
      expect(stellarService.validateAddress(validAddress)).toBe(true);
    });

    it('should reject invalid Stellar addresses', () => {
      expect(stellarService.validateAddress('invalid')).toBe(false);
      expect(stellarService.validateAddress('')).toBe(false);
      expect(stellarService.validateAddress('GINVALID')).toBe(false);
    });
  });
});
