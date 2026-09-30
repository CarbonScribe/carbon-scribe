import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  storeTokens,
  getAccessToken,
  getRefreshToken,
  getTokenExpiry,
  isTokenExpired,
  clearAuthData,
  storeUser,
  getUser,
  hasRefreshToken,
  isAuthenticated,
} from './token-storage';

/** Builds an unsigned JWT-shaped string carrying the given payload, for
 * exercising the JWT-exp-derived expiry logic without a real signing key. */
function makeFakeJwt(payload: Record<string, unknown>): string {
  const base64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(payload)}.signature`;
}

describe('Token Storage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  });

  it('should store and retrieve access token', () => {
    storeTokens('access123', 'refresh456', 900);
    expect(getAccessToken()).toBe('access123');
  });

  it('should store and retrieve refresh token', () => {
    storeTokens('access123', 'refresh456', 900);
    expect(getRefreshToken()).toBe('refresh456');
  });

  it('should check if token is expired', () => {
    // Token expires in 1 second
    storeTokens('access123', 'refresh456', 1);
    expect(isTokenExpired(0)).toBe(false);

    // Wait for expiration
    setTimeout(() => {
      expect(isTokenExpired(0)).toBe(true);
    }, 1100);
  });

  it('should check if token is about to expire with buffer', () => {
    // Token expires in 120 seconds
    storeTokens('access123', 'refresh456', 120);
    
    // With 60 second buffer, should be considered expired
    expect(isTokenExpired(60)).toBe(false);
  });

  it('should check if refresh token exists', () => {
    expect(hasRefreshToken()).toBe(false);
    storeTokens('access123', 'refresh456', 900);
    expect(hasRefreshToken()).toBe(true);
  });

  it('should store and retrieve only minimal, non-sensitive user fields', () => {
    // email/role/companyId are deliberately excluded from storage (#555)
    // even when passed in — storeUser only accepts the minimal shape.
    const user = { id: '1', firstName: 'Test', lastName: 'User' };
    storeUser(user);
    expect(getUser()).toEqual(user);
  });

  it('should clear all auth data', () => {
    storeTokens('access123', 'refresh456', 900);
    storeUser({ id: '1', firstName: 'Test', lastName: 'User' });

    clearAuthData();
    
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getUser()).toBeNull();
  });

  it('should check if user is authenticated', () => {
    expect(isAuthenticated()).toBe(false);
    
    storeTokens('access123', 'refresh456', 900);
    expect(isAuthenticated()).toBe(true);
    
    // Expired token
    storeTokens('access123', 'refresh456', 0);
    expect(isAuthenticated()).toBe(false);
  });

  it('does not migrate legacy accessToken/access_token keys (#555)', () => {
    localStorage.setItem('accessToken', 'legacy-value-1');
    localStorage.setItem('access_token', 'legacy-value-2');

    expect(getAccessToken()).toBeNull();
    // The legacy keys must also be left untouched, not silently adopted.
    expect(localStorage.getItem('accessToken')).toBe('legacy-value-1');
    expect(localStorage.getItem('access_token')).toBe('legacy-value-2');
  });

  it('derives token expiry from the access token JWT exp claim, not the passed expiresIn (#555)', () => {
    const expSeconds = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const jwt = makeFakeJwt({ sub: 'user-1', exp: expSeconds });

    // Pass a mismatched expiresIn (10s) — the JWT's own exp claim should win.
    storeTokens(jwt, 'refresh456', 10);

    const expiry = getTokenExpiry();
    expect(expiry).toBe(expSeconds * 1000);
    expect(isTokenExpired(0)).toBe(false);
  });

  it('treats a JWT past its own exp claim as expired even with a generous expiresIn', () => {
    const expSeconds = Math.floor(Date.now() / 1000) - 60; // already expired
    const jwt = makeFakeJwt({ sub: 'user-1', exp: expSeconds });

    storeTokens(jwt, 'refresh456', 900);

    expect(isTokenExpired(0)).toBe(true);
  });

  it('falls back to the stored expiry timestamp for a non-JWT (opaque) token', () => {
    // Plain test tokens like 'access123' aren't JWT-shaped — getTokenExpiry
    // must still work via the TOKEN_EXPIRY_KEY fallback.
    storeTokens('access123', 'refresh456', 900);

    const expiry = getTokenExpiry();
    expect(expiry).not.toBeNull();
    expect(isTokenExpired(0)).toBe(false);
  });

  it('never persists sensitive fields even if a caller bypasses the type check', () => {
    const wideUser = {
      id: '1',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      role: 'admin',
      companyId: 'company-42',
    };
    // Simulates a loosely-typed call site (e.g. from an `any`-typed API
    // response) that still passes extra fields at runtime.
    storeUser(wideUser as any);

    const stored = getUser() as any;
    expect(stored).toEqual({ id: '1', firstName: 'Test', lastName: 'User' });
    expect(stored.email).toBeUndefined();
    expect(stored.role).toBeUndefined();
    expect(stored.companyId).toBeUndefined();
  });
});
