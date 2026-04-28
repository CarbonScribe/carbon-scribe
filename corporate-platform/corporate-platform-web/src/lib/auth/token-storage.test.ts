import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  storeTokens,
  getAccessToken,
  getRefreshToken,
  isTokenExpired,
  clearAuthData,
  storeUser,
  getUser,
  hasRefreshToken,
  isAuthenticated,
} from './token-storage';

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

  it('should store and retrieve user data', () => {
    const user = { id: '1', email: 'test@example.com', firstName: 'Test', lastName: 'User' };
    storeUser(user);
    expect(getUser()).toEqual(user);
  });

  it('should clear all auth data', () => {
    storeTokens('access123', 'refresh456', 900);
    storeUser({ id: '1', email: 'test@example.com' });
    
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
});
