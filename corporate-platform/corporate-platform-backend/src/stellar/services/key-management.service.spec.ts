import { Test, TestingModule } from '@nestjs/testing';
import { KeyManagementService } from './key-management.service';
import { ConfigService } from '../../config/config.service';

let keypairCallCount = 0;

jest.mock('@stellar/stellar-sdk', () => ({
  Keypair: {
    random: jest.fn().mockImplementation(() => {
      keypairCallCount++;
      return {
        publicKey: jest
          .fn()
          .mockReturnValue(
            `GCKPKAV5V6VNZLZJ7U3DBYTG7P7P2DZFKDDI7IMVYXEX3H5HNYP3WBK${keypairCallCount}`,
          ),
        secret: jest
          .fn()
          .mockReturnValue(
            `SBJGKHLIKSSTPTQCTQBKW5LZSWYOIRMXKCVB7JABHQWDGKWYV3PTJMV${keypairCallCount}`,
          ),
      };
    }),
    fromPublicKey: jest.fn().mockImplementation((publicKey: string) => {
      if (publicKey.startsWith('G') && publicKey.length === 56) {
        return { publicKey: () => publicKey };
      }
      throw new Error('Invalid public key');
    }),
    fromSecret: jest.fn().mockImplementation((secret: string) => {
      if (secret.startsWith('S') && secret.length === 56) {
        return {
          publicKey: () =>
            'GCKPKAV5V6VNZLZJ7U3DBYTG7P7P2DZFKDDI7IMVYXEX3H5HNYP3WBK7',
        };
      }
      throw new Error('Invalid secret key');
    }),
  },
}));

describe('KeyManagementService', () => {
  let service: KeyManagementService;

  beforeEach(async () => {
    const mockConfigService = {
      getStellarConfig: jest.fn().mockReturnValue({
        encryptionKey: Buffer.alloc(32, 1).toString('base64'),
      }),
      getAuthConfig: jest.fn().mockReturnValue({
        jwtSecret: 'test-jwt-secret',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeyManagementService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<KeyManagementService>(KeyManagementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateKeypair', () => {
    it('should generate a valid Stellar keypair', () => {
      const keypair = service.generateKeypair();

      expect(keypair).toHaveProperty('publicKey');
      expect(keypair).toHaveProperty('secret');
      expect(keypair.publicKey).toMatch(/^G[A-Z0-9]{55}$/);
      expect(keypair.secret).toMatch(/^S[A-Z0-9]{55}$/);
    });

    it('should generate unique keypairs each time', () => {
      const keypair1 = service.generateKeypair();
      const keypair2 = service.generateKeypair();

      expect(keypair1.publicKey).not.toBe(keypair2.publicKey);
      expect(keypair1.secret).not.toBe(keypair2.secret);
    });
  });

  describe('encryptPrivateKey', () => {
    it('should encrypt a private key', () => {
      const secret = 'SBJGKHLIKSSTPTQCTQBKW5LZSWYOIRMXKCVB7JABHQWDGKWYV3PTJMVH';
      const encrypted = service.encryptPrivateKey(secret);

      expect(encrypted).toHaveProperty('encryptedData');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted.encryptedData).not.toBe(secret);
    });
  });

  describe('decryptPrivateKey', () => {
    it('should decrypt an encrypted private key', () => {
      const secret = 'SBJGKHLIKSSTPTQCTQBKW5LZSWYOIRMXKCVB7JABHQWDGKWYV3PTJMVH';
      const encrypted = service.encryptPrivateKey(secret);
      const decrypted = service.decryptPrivateKey(encrypted);

      expect(decrypted).toBe(secret);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const secret = 'SBJGKHLIKSSTPTQCTQBKW5LZSWYOIRMXKCVB7JABHQWDGKWYV3PTJMVH';
      const encrypted1 = service.encryptPrivateKey(secret);
      const encrypted2 = service.encryptPrivateKey(secret);

      expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });
  });

  describe('validatePublicKey', () => {
    it('should return true for valid public key', () => {
      const validPublicKey =
        'GCKPKAV5V6VNZLZJ7U3DBYTG7P7P2DZFKDDI7IMVYXEX3H5HNYP3WBK7';
      expect(service.validatePublicKey(validPublicKey)).toBe(true);
    });

    it('should return false for invalid public key', () => {
      expect(service.validatePublicKey('invalid')).toBe(false);
      expect(service.validatePublicKey('')).toBe(false);
      expect(service.validatePublicKey('GINVALID')).toBe(false);
    });
  });

  describe('validateSecretKey', () => {
    it('should return true for valid secret key', () => {
      const validSecret =
        'SBJGKHLIKSSTPTQCTQBKW5LZSWYOIRMXKCVB7JABHQWDGKWYV3PTJMVH';
      expect(service.validateSecretKey(validSecret)).toBe(true);
    });

    it('should return false for invalid secret key', () => {
      expect(service.validateSecretKey('invalid')).toBe(false);
      expect(service.validateSecretKey('')).toBe(false);
      expect(service.validateSecretKey('SINVALID')).toBe(false);
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate a base64 encoded 32-byte key', () => {
      const key = service.generateEncryptionKey();
      const decoded = Buffer.from(key, 'base64');

      expect(decoded.length).toBe(32);
      expect(key).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('should generate unique keys each time', () => {
      const key1 = service.generateEncryptionKey();
      const key2 = service.generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });
  });
});
