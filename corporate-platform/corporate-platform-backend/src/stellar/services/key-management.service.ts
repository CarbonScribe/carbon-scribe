import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import * as crypto from 'crypto';
import * as StellarSdk from '@stellar/stellar-sdk';
import { IKeyPairEncrypted, IStellarKeypair } from '../interfaces/stellar.interface';

@Injectable()
export class KeyManagementService {
  private readonly logger = new Logger(KeyManagementService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly authTagLength = 16;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Generate a new Stellar keypair
   */
  generateKeypair(): IStellarKeypair {
    const keypair = StellarSdk.Keypair.random();
    return {
      publicKey: keypair.publicKey(),
      secret: keypair.secret(),
    };
  }

  /**
   * Encrypt a private key using AES-256-GCM
   */
  encryptPrivateKey(secret: string): IKeyPairEncrypted {
    const encryptionKey = this.getEncryptionKey();
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, encryptionKey, iv);

    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encryptedData: encrypted,
      authTag: authTag.toString('hex'),
      iv: iv.toString('hex'),
    };
  }

  /**
   * Decrypt a private key using AES-256-GCM
   */
  decryptPrivateKey(encryptedData: IKeyPairEncrypted): string {
    const encryptionKey = this.getEncryptionKey();
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Validate a Stellar public key
   */
  validatePublicKey(publicKey: string): boolean {
    try {
      StellarSdk.Keypair.fromPublicKey(publicKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate a Stellar secret key
   */
  validateSecretKey(secret: string): boolean {
    try {
      StellarSdk.Keypair.fromSecret(secret);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get or generate encryption key
   */
  private getEncryptionKey(): Buffer {
    const config = this.configService.getStellarConfig();
    const keyBase64 = config.encryptionKey;

    if (keyBase64) {
      const key = Buffer.from(keyBase64, 'base64');
      if (key.length !== this.keyLength) {
        throw new Error(`Encryption key must be ${this.keyLength} bytes when decoded from base64`);
      }
      return key;
    }

    // Fallback: Generate a deterministic key from JWT secret (for dev/test only)
    const authConfig = this.configService.getAuthConfig();
    const fallbackKey = crypto
      .createHash('sha256')
      .update(authConfig.jwtSecret)
      .digest();
    
    this.logger.warn('Using fallback encryption key derived from JWT secret. Set ENCRYPTION_KEY for production!');
    return fallbackKey;
  }

  /**
   * Generate a new secure encryption key (for setup purposes)
   */
  generateEncryptionKey(): string {
    const key = crypto.randomBytes(this.keyLength);
    return key.toString('base64');
  }
}
