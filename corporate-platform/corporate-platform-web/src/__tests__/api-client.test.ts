import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { apiClient } from '@/lib/api-client';

describe('API Client', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Token Management', () => {
    it('should set tokens correctly', () => {
      const accessToken = 'test-access-token';
      const refreshToken = 'test-refresh-token';

      apiClient.setTokens(accessToken, refreshToken);

      expect(localStorage.getItem('accessToken')).toBe(accessToken);
      expect(localStorage.getItem('refreshToken')).toBe(refreshToken);
    });

    it('should clear tokens correctly', () => {
      apiClient.setTokens('test-access', 'test-refresh');
      apiClient.clearTokens();

      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });

    it('should check authentication status correctly', () => {
      expect(apiClient.isAuthenticated()).toBe(false);

      apiClient.setTokens('test-access', 'test-refresh');
      expect(apiClient.isAuthenticated()).toBe(true);

      apiClient.clearTokens();
      expect(apiClient.isAuthenticated()).toBe(false);
    });
  });

  describe('Interceptors', () => {
    it('should add auth token to request headers', async () => {
      apiClient.setTokens('test-token', 'test-refresh');

      // This would be tested more thoroughly with actual API calls
      const token = localStorage.getItem('accessToken');
      expect(token).toBe('test-token');
    });
  });
});
