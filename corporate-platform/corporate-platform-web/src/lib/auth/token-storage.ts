/**
 * Secure Token Storage
 * 
 * Uses HTTP-only cookies for refresh tokens (secure against XSS)
 * and localStorage for access tokens (with auto-refresh logic)
 * 
 * Note: For production, consider using HTTP-only cookies for both tokens
 * with server-side token management.
 */

const ACCESS_TOKEN_KEY = 'cs_access_token';
const REFRESH_TOKEN_KEY = 'cs_refresh_token';
const USER_KEY = 'cs_user';
const TOKEN_EXPIRY_KEY = 'cs_token_expiry';

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Timestamp when access token expires
}

/**
 * Store authentication tokens securely
 */
export function storeTokens(accessToken: string, refreshToken: string, expiresIn: number = 900): void {
  if (typeof window === 'undefined') return;

  const expiresAt = Date.now() + expiresIn * 1000;
  
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt.toString());
  } catch (error) {
    console.error('Failed to store tokens:', error);
  }
}

/**
 * Get the stored access token
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to get access token:', error);
    return null;
  }
}

/**
 * Get the stored refresh token
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to get refresh token:', error);
    return null;
  }
}

/**
 * Get token expiry timestamp
 */
export function getTokenExpiry(): number | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    return expiry ? parseInt(expiry, 10) : null;
  } catch (error) {
    console.error('Failed to get token expiry:', error);
    return null;
  }
}

/**
 * Check if the access token is expired or about to expire
 * @param bufferSeconds - Buffer time before actual expiry (default: 60 seconds)
 */
export function isTokenExpired(bufferSeconds: number = 60): boolean {
  const expiry = getTokenExpiry();
  if (!expiry) return true;
  
  const now = Date.now();
  return now >= (expiry - bufferSeconds * 1000);
}

/**
 * Check if refresh token exists
 */
export function hasRefreshToken(): boolean {
  return getRefreshToken() !== null;
}

/**
 * Clear all authentication data
 */
export function clearAuthData(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (error) {
    console.error('Failed to clear auth data:', error);
  }
}

/**
 * Store user data
 */
export function storeUser(user: any): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Failed to store user:', error);
  }
}

/**
 * Get stored user data
 */
export function getUser(): any | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error('Failed to get user:', error);
    return null;
  }
}

/**
 * Check if user is authenticated (has valid tokens)
 */
export function isAuthenticated(): boolean {
  const hasToken = getAccessToken() !== null;
  const notExpired = !isTokenExpired();
  return hasToken && notExpired;
}
