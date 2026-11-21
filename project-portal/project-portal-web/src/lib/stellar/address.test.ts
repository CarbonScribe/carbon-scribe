import { describe, it, expect } from 'vitest';
import { isValidStellarAddress, normalizeStellarAddress, validateStellarAddress } from './address';

// A real, checksum-valid Ed25519 Stellar public key.
const VALID_ADDRESS = 'GCUARJVWFF6OZP2SWL2JOLTFMNLMJDEAISPRPBTVSMELNTLLCXR6F5ZQ';
// Same prefix/length/alphabet, last character flipped — invalid checksum.
const CHECKSUM_INVALID = 'GCUARJVWFF6OZP2SWL2JOLTFMNLMJDEAISPRPBTVSMELNTLLCXR6F5ZA';
// Contains '0', which is outside Stellar's base32 alphabet.
const INVALID_CHARACTER = 'GCUARJVWFF6OZP2SWL2JOLTFMNLMJDEAISPRPBTVSMELNTLLCXR6F5Z0';

describe('isValidStellarAddress (#803)', () => {
  it('accepts a real, checksum-valid address', () => {
    expect(isValidStellarAddress(VALID_ADDRESS)).toBe(true);
  });

  it('rejects an address with an invalid checksum', () => {
    expect(isValidStellarAddress(CHECKSUM_INVALID)).toBe(false);
  });

  it("rejects an address containing a character outside Stellar's base32 alphabet", () => {
    expect(isValidStellarAddress(INVALID_CHARACTER)).toBe(false);
  });

  it('rejects a non-G prefix', () => {
    expect(isValidStellarAddress(`M${VALID_ADDRESS.slice(1)}`)).toBe(false);
  });

  it('rejects the wrong length', () => {
    expect(isValidStellarAddress(VALID_ADDRESS.slice(0, -1))).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidStellarAddress('')).toBe(false);
  });

  it('accepts a lowercase address', () => {
    expect(isValidStellarAddress(VALID_ADDRESS.toLowerCase())).toBe(true);
  });

  it('accepts an address with surrounding whitespace', () => {
    expect(isValidStellarAddress(`  ${VALID_ADDRESS}  `)).toBe(true);
    expect(isValidStellarAddress(`\n${VALID_ADDRESS}\t`)).toBe(true);
  });
});

describe('normalizeStellarAddress', () => {
  it('trims whitespace and upper-cases the input', () => {
    expect(normalizeStellarAddress(`  ${VALID_ADDRESS.toLowerCase()}  `)).toBe(VALID_ADDRESS);
  });
});

describe('validateStellarAddress (#803)', () => {
  it('returns valid: true with the normalized address for a good value', () => {
    const result = validateStellarAddress(`  ${VALID_ADDRESS.toLowerCase()}  `);
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe(VALID_ADDRESS);
    expect(result.errorCode).toBeUndefined();
  });

  it('classifies an empty value', () => {
    const result = validateStellarAddress('   ');
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('empty');
  });

  it('classifies a missing "G" prefix', () => {
    const result = validateStellarAddress(`M${VALID_ADDRESS.slice(1)}`);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('prefix');
  });

  it('classifies the wrong length', () => {
    const result = validateStellarAddress(VALID_ADDRESS.slice(0, -5));
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('length');
  });

  it('classifies a bad checksum', () => {
    const result = validateStellarAddress(CHECKSUM_INVALID);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('checksum');
  });

  it('classifies an invalid character as a checksum-style failure', () => {
    const result = validateStellarAddress(INVALID_CHARACTER);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('checksum');
  });
});
