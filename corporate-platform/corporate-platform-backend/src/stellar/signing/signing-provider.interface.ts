/**
 * Abstraction over Stellar transaction signing (#542).
 * Callers must never touch process.env.STELLAR_SECRET_KEY directly.
 */
export type SigningCategory = 'contract' | 'transfer';

export interface SignedPayload {
  /** XDR or base64 of the signed transaction */
  signedXdr: string;
  /** Public key that performed the signature (for audit logs) */
  publicKey: string;
  /** Optional key version / KMS key id */
  keyId?: string;
}

export interface SigningProvider {
  /** Stable identifier for logs / rotation tracking */
  readonly keyId: string;
  readonly category: SigningCategory;

  /** Returns the public key without exposing secret material */
  getPublicKey(): Promise<string>;

  /**
   * Sign a prepared transaction XDR string.
   * Implementations must not retain secret material longer than needed.
   */
  signTransaction(txXdr: string, networkPassphrase: string): Promise<SignedPayload>;

  /** True when this provider produces real on-chain signatures */
  isLive(): boolean;
}

export const SIGNING_PROVIDER_CONTRACT = 'SIGNING_PROVIDER_CONTRACT';
export const SIGNING_PROVIDER_TRANSFER = 'SIGNING_PROVIDER_TRANSFER';
