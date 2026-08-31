import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  SignedPayload,
  SigningCategory,
  SigningProvider,
} from './signing-provider.interface';

/**
 * Production SigningProvider skeleton for AWS KMS / HashiCorp Vault.
 *
 * Configuration:
 *   STELLAR_SIGNING_PROVIDER=kms|vault
 *   STELLAR_KMS_KEY_ID=...
 *   STELLAR_KMS_PUBLIC_KEY=G...
 *
 * Wire the actual KMS Sign API in deploy-specific code; this class enforces
 * the interface contract and fails closed when misconfigured.
 *
 * Key rotation: update STELLAR_KMS_KEY_ID / public key in config (or Vault
 * path) and restart; no code change required. In-flight txs using the old
 * key version should complete; new txs use the new key id.
 */
@Injectable()
export class KmsSigningProvider implements SigningProvider, OnModuleInit {
  private readonly logger = new Logger(KmsSigningProvider.name);
  readonly keyId: string;
  readonly category: SigningCategory;
  private readonly publicKey: string | undefined;
  private readonly enabled: boolean;

  constructor(category: SigningCategory = 'contract') {
    this.category = category;
    this.keyId =
      process.env.STELLAR_KMS_KEY_ID ||
      process.env.STELLAR_VAULT_KEY_PATH ||
      `kms:${category}:unconfigured`;
    this.publicKey = process.env.STELLAR_KMS_PUBLIC_KEY;
    this.enabled =
      (process.env.STELLAR_SIGNING_PROVIDER || '').toLowerCase() === 'kms' ||
      (process.env.STELLAR_SIGNING_PROVIDER || '').toLowerCase() === 'vault';
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.debug(`KmsSigningProvider not selected (category=${this.category})`);
      return;
    }
    if (!this.publicKey) {
      throw new Error(
        `STELLAR_SIGNING_PROVIDER=kms|vault requires STELLAR_KMS_PUBLIC_KEY for ${this.keyId}`,
      );
    }
    this.logger.log(
      `KMS/Vault signing provider ready category=${this.category} keyId=${this.keyId} publicKey=${this.publicKey}`,
    );
  }

  isLive(): boolean {
    return this.enabled && !!this.publicKey;
  }

  async getPublicKey(): Promise<string> {
    if (!this.publicKey) {
      throw new Error(`KMS public key not configured for ${this.keyId}`);
    }
    return this.publicKey;
  }

  async signTransaction(
    _txXdr: string,
    _networkPassphrase: string,
  ): Promise<SignedPayload> {
    if (!this.isLive()) {
      throw new Error(`KMS signing provider is not live (${this.keyId})`);
    }
    // Production: call AWS KMS Sign or Vault transit/sign and attach signature
    // to the transaction envelope. Kept as an explicit failure so mis-wired
    // deploys do not fall back to env secrets.
    throw new Error(
      `KmsSigningProvider.signTransaction is not wired to a live KMS client yet ` +
        `(keyId=${this.keyId}). Configure AWS KMS / Vault client integration.`,
    );
  }
}
