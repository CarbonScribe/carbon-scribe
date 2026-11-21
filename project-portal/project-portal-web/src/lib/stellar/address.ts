import { StrKey } from '@stellar/stellar-sdk';

const EXPECTED_LENGTH = 56;

export type StellarAddressErrorCode = 'empty' | 'prefix' | 'length' | 'checksum';

export interface StellarAddressValidationResult {
  valid: boolean;
  /** Trimmed, upper-cased form of the input, regardless of validity. */
  normalized: string;
  errorCode?: StellarAddressErrorCode;
  errorMessage?: string;
}

/**
 * Trims surrounding whitespace and upper-cases the input (#803) — StrKey's
 * base32 alphabet is uppercase-only, and a pasted or hand-typed address
 * commonly carries stray whitespace or lowercase characters that a human
 * reader would still recognize as "the same address".
 */
export function normalizeStellarAddress(address: string): string {
  return address.trim().toUpperCase();
}

/**
 * The single, strict Stellar public-key ("G...") validator (#803).
 *
 * Replaces three previously divergent implementations: a loose regex in
 * lib/stellar/wallet.ts (`/^G[A-Z0-9]{55}$/`) that accepted characters
 * outside Stellar's base32 alphabet (0, 1, 8, 9 are never valid) and never
 * checked the CRC16 checksum, and two separate `Keypair.fromPublicKey`
 * try/catch copies in retirement.ts and carbonTokens.ts. All three call
 * sites now delegate here, which in turn delegates to the SDK's own
 * `StrKey.isValidEd25519PublicKey` — the version byte, alphabet, length
 * and checksum are all validated in one pass.
 */
export function isValidStellarAddress(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(normalizeStellarAddress(address));
}

/**
 * Validates address and classifies *why* it failed (#803), so a form can
 * show a specific inline message (wrong prefix / wrong length / bad
 * checksum) instead of a single generic "invalid address" error.
 */
export function validateStellarAddress(address: string): StellarAddressValidationResult {
  const normalized = normalizeStellarAddress(address);

  if (!normalized) {
    return {
      valid: false,
      normalized,
      errorCode: 'empty',
      errorMessage: 'Enter a Stellar address.',
    };
  }

  if (!normalized.startsWith('G')) {
    return {
      valid: false,
      normalized,
      errorCode: 'prefix',
      errorMessage: 'A Stellar public address starts with "G".',
    };
  }

  if (normalized.length !== EXPECTED_LENGTH) {
    return {
      valid: false,
      normalized,
      errorCode: 'length',
      errorMessage: `A Stellar address must be ${EXPECTED_LENGTH} characters long (got ${normalized.length}).`,
    };
  }

  if (!StrKey.isValidEd25519PublicKey(normalized)) {
    return {
      valid: false,
      normalized,
      errorCode: 'checksum',
      errorMessage: 'This address has an invalid character or failed its checksum — check for a typo.',
    };
  }

  return { valid: true, normalized };
}
