import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  SignedPayload,
  SigningCategory,
  SigningProvider,
} from './signing-provider.interface';

/**
 * Dev/default SigningProvider backed by env vars.
 * Production should prefer KmsSigningProvider.
 *
 * Env:
 *   STELLAR_SIGNING_MODE=simulate|live
 *   STELLAR_SECRET_KEY              — default / contract key
 *   STELLAR_TRANSFER_SECRET_KEY     — optional distinct transfer key
 */
@Injectable()
export class EnvSigningProvider implements SigningProvider, OnModuleInit {
  private readonly logger = new Logger(EnvSigningProvider.name);
  readonly keyId: string;
  readonly category: SigningCategory;
  private readonly secret: string | undefined;
  private readonly mode: 'simulate' | 'live';
  private publicKeyCache: string | null = null;

  constructor(
    category: SigningCategory = 'contract',
    secretEnvKey = 'STELLAR_SECRET_KEY',
  ) {
    this.category = category;
    this.mode =
      (process.env.STELLAR_SIGNING_MODE || '').toLowerCase() === 'live'
        ? 'live'
        : 'simulate';
    this.secret = process.env[secretEnvKey] || process.env.STELLAR_SECRET_KEY;
    this.keyId = `env:${category}:${secretEnvKey}`;
  }

  onModuleInit(): void {
    if (this.mode === 'live') {
      if (!this.secret) {
        throw new Error(
          `STELLAR_SIGNING_MODE=live but no secret configured for ${this.keyId}. ` +
            `Set STELLAR_SECRET_KEY (and optionally STELLAR_TRANSFER_SECRET_KEY).`,
        );
      }
      try {
        const kp = StellarSdk.Keypair.fromSecret(this.secret);
        this.publicKeyCache = kp.publicKey();
        this.logger.log(
          `Signing provider ready category=${this.category} publicKey=${this.publicKeyCache}`,
        );
      } catch (err) {
        throw new Error(
          `Invalid Stellar signing secret for ${this.keyId}: ${(err as Error).message}`,
        );
      }
    } else {
      this.logger.warn(
        `Signing provider in SIMULATE mode (category=${this.category}). ` +
          `Set STELLAR_SIGNING_MODE=live with a valid key for real transactions.`,
      );
    }
  }

  isLive(): boolean {
    return this.mode === 'live' && !!this.secret;
  }

  async getPublicKey(): Promise<string> {
    if (this.publicKeyCache) return this.publicKeyCache;
    if (!this.secret) {
      // Deterministic mock key for simulate mode
      return 'G_SIMULATE_' + this.category.toUpperCase();
    }
    const kp = StellarSdk.Keypair.fromSecret(this.secret);
    this.publicKeyCache = kp.publicKey();
    return this.publicKeyCache;
  }

  async signTransaction(
    txXdr: string,
    networkPassphrase: string,
  ): Promise<SignedPayload> {
    if (!this.isLive() || !this.secret) {
      throw new Error(
        `Cannot sign in simulate mode (provider=${this.keyId}). ` +
          `Set STELLAR_SIGNING_MODE=live and configure a valid secret.`,
      );
    }
    const keypair = StellarSdk.Keypair.fromSecret(this.secret);
    const tx = StellarSdk.TransactionBuilder.fromXDR(txXdr, networkPassphrase);
    (tx as StellarSdk.Transaction).sign(keypair);
    const publicKey = keypair.publicKey();
    this.logger.log(
      JSON.stringify({
        event: 'stellar_tx_signed',
        category: this.category,
        publicKey,
        keyId: this.keyId,
      }),
    );
    return {
      signedXdr: tx.toXDR(),
      publicKey,
      keyId: this.keyId,
    };
  }
}

/** Factory helpers for Nest providers */
export function createContractSigningProvider(): EnvSigningProvider {
  return new EnvSigningProvider('contract', 'STELLAR_SECRET_KEY');
}

export function createTransferSigningProvider(): EnvSigningProvider {
  return new EnvSigningProvider(
    'transfer',
    process.env.STELLAR_TRANSFER_SECRET_KEY
      ? 'STELLAR_TRANSFER_SECRET_KEY'
      : 'STELLAR_SECRET_KEY',
  );
}
