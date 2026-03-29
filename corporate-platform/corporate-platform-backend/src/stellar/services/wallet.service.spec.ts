import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { KeyManagementService } from './key-management.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { WalletStatus, TransactionStatus, OperationType } from '../interfaces/stellar.interface';

describe('WalletService', () => {
  let service: WalletService;
  let prismaService: any;
  let keyManagementService: any;

  const mockWallet = {
    id: 'wallet-1',
    companyId: 'company-1',
    publicKey: 'GCKPKAV5V6VNZLZJ7U3DBYTG7P7P2DZFKDDI7IMVYXEX3H5HNYP3WBK7',
    encryptedSecret: JSON.stringify({
      encryptedData: 'encrypted',
      authTag: 'authTag',
      iv: 'iv',
    }),
    status: WalletStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prismaService = {
      corporateWallet: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      walletTransaction: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };

    keyManagementService = {
      generateKeypair: jest.fn().mockReturnValue({
        publicKey: 'GCKPKAV5V6VNZLZJ7U3DBYTG7P7P2DZFKDDI7IMVYXEX3H5HNYP3WBK7',
        secret: 'SBJGKHLIKSSTPTQCTQBKW5LZSWYOIRMXKCVB7JABHQWDGKWYV3PTJMVH',
      }),
      encryptPrivateKey: jest.fn().mockReturnValue({
        encryptedData: 'encrypted',
        authTag: 'authTag',
        iv: 'iv',
      }),
      decryptPrivateKey: jest.fn().mockReturnValue('SBJGKHLIKSSTPTQCTQBKW5LZSWYOIRMXKCVB7JABHQWDGKWYV3PTJMVH'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: PrismaService,
          useValue: prismaService,
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
    it('should create a new wallet', async () => {
      prismaService.corporateWallet.findUnique.mockResolvedValue(null);
      prismaService.corporateWallet.create.mockResolvedValue(mockWallet);

      const result = await service.createWallet({ companyId: 'company-1' });

      expect(result).toHaveProperty('id');
      expect(result.companyId).toBe('company-1');
      expect(result.publicKey).toBe('GCKPKAV5V6VNZLZJ7U3DBYTG7P7P2DZFKDDI7IMVYXEX3H5HNYP3WBK7');
      expect(result.status).toBe(WalletStatus.ACTIVE);
    });

    it('should throw ConflictException if wallet already exists', async () => {
      prismaService.corporateWallet.findUnique.mockResolvedValue(mockWallet);

      await expect(service.createWallet({ companyId: 'company-1' }))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('getWalletByCompanyId', () => {
    it('should return wallet by company ID', async () => {
      prismaService.corporateWallet.findUnique.mockResolvedValue(mockWallet);

      const result = await service.getWalletByCompanyId('company-1');

      expect(result.id).toBe('wallet-1');
      expect(result.companyId).toBe('company-1');
    });

    it('should throw NotFoundException if wallet not found', async () => {
      prismaService.corporateWallet.findUnique.mockResolvedValue(null);

      await expect(service.getWalletByCompanyId('unknown-company'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('updateWalletStatus', () => {
    it('should update wallet status', async () => {
      const updatedWallet = { ...mockWallet, status: WalletStatus.LOCKED };
      prismaService.corporateWallet.update.mockResolvedValue(updatedWallet);

      const result = await service.updateWalletStatus('company-1', WalletStatus.LOCKED);

      expect(result.status).toBe(WalletStatus.LOCKED);
    });
  });

  describe('isWalletActive', () => {
    it('should return true for active wallet', async () => {
      prismaService.corporateWallet.findUnique.mockResolvedValue(mockWallet);

      const result = await service.isWalletActive('company-1');

      expect(result).toBe(true);
    });

    it('should return false for locked wallet', async () => {
      prismaService.corporateWallet.findUnique.mockResolvedValue({
        ...mockWallet,
        status: WalletStatus.LOCKED,
      });

      const result = await service.isWalletActive('company-1');

      expect(result).toBe(false);
    });

    it('should return false if wallet not found', async () => {
      prismaService.corporateWallet.findUnique.mockResolvedValue(null);

      const result = await service.isWalletActive('unknown-company');

      expect(result).toBe(false);
    });
  });

  describe('getSecretKey', () => {
    it('should return decrypted secret key', async () => {
      prismaService.corporateWallet.findUnique.mockResolvedValue(mockWallet);

      const result = await service.getSecretKey('company-1');

      expect(result).toBe('SBJGKHLIKSSTPTQCTQBKW5LZSWYOIRMXKCVB7JABHQWDGKWYV3PTJMVH');
    });

    it('should throw ConflictException for non-active wallet', async () => {
      prismaService.corporateWallet.findUnique.mockResolvedValue({
        ...mockWallet,
        status: WalletStatus.LOCKED,
      });

      await expect(service.getSecretKey('company-1'))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('getPublicKey', () => {
    it('should return public key', async () => {
      prismaService.corporateWallet.findUnique.mockResolvedValue(mockWallet);

      const result = await service.getPublicKey('company-1');

      expect(result).toBe('GCKPKAV5V6VNZLZJ7U3DBYTG7P7P2DZFKDDI7IMVYXEX3H5HNYP3WBK7');
    });
  });

  describe('recordTransaction', () => {
    it('should record a transaction', async () => {
      const mockTransaction = {
        id: 'tx-1',
        companyId: 'company-1',
        walletId: 'wallet-1',
        transactionHash: 'abc123',
        operationType: OperationType.TRANSFER,
        status: TransactionStatus.PENDING,
        amount: 100,
        tokenIds: [1, 2, 3],
        metadata: {},
        submittedAt: new Date(),
        confirmedAt: null,
      };
      prismaService.walletTransaction.create.mockResolvedValue(mockTransaction);

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
    });
  });
});
