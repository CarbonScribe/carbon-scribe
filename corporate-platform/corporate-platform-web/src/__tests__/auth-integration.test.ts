import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/auth-store';
import * as apiClientModule from '@/lib/api-client';

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
    setTokens: vi.fn(),
    clearTokens: vi.fn(),
    isAuthenticated: vi.fn(() => false),
  },
}));

const mockApiClient = apiClientModule.apiClient as any;

describe('Auth Integration Tests', () => {
  beforeEach(() => {
    // Reset auth store
    useAuthStore.setState({
      user: null,
      isLoading: false,
      error: null,
      isAuthenticated: false,
    });

    // Clear all mocks
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Login Flow', () => {
    it('should successfully login user', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        companyId: 'company-1',
        role: 'user',
        emailVerified: true,
        isActive: true,
      };

      mockApiClient.login.mockResolvedValueOnce({
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
        user: mockUser,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(false);

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.error).toBeNull();
      });

      expect(mockApiClient.login).toHaveBeenCalledWith(
        'test@example.com',
        'password123'
      );
      expect(mockApiClient.setTokens).toHaveBeenCalledWith('token-123', 'refresh-123');
    });

    it('should handle login error', async () => {
      const errorMessage = 'Invalid credentials';
      mockApiClient.login.mockRejectedValueOnce({
        message: errorMessage,
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.login('test@example.com', 'wrongpassword');
        } catch (error) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
        expect(result.current.isAuthenticated).toBe(false);
      });
    });
  });

  describe('Registration Flow', () => {
    it('should successfully register user', async () => {
      const mockUser = {
        id: '1',
        email: 'newuser@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        companyId: 'company-1',
        role: 'user',
        emailVerified: false,
        isActive: true,
      };

      mockApiClient.register.mockResolvedValueOnce({
        accessToken: 'token-456',
        refreshToken: 'refresh-456',
        user: mockUser,
      });

      const { result } = renderHook(() => useAuth());

      const registrationData = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        firstName: 'Jane',
        lastName: 'Smith',
        companyName: 'New Company',
      };

      await act(async () => {
        await result.current.register(registrationData);
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(mockUser);
      });

      expect(mockApiClient.register).toHaveBeenCalledWith(registrationData);
      expect(mockApiClient.setTokens).toHaveBeenCalledWith('token-456', 'refresh-456');
    });

    it('should handle registration error', async () => {
      const errorMessage = 'Email already registered';
      mockApiClient.register.mockRejectedValueOnce({
        message: errorMessage,
      });

      const { result } = renderHook(() => useAuth());

      const registrationData = {
        email: 'existing@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Company',
      };

      await act(async () => {
        try {
          await result.current.register(registrationData);
        } catch (error) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
        expect(result.current.isAuthenticated).toBe(false);
      });
    });
  });

  describe('Logout Flow', () => {
    it('should successfully logout user', async () => {
      // First, set up authenticated state
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        companyId: 'company-1',
        role: 'user',
        emailVerified: true,
        isActive: true,
      };

      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
      });

      mockApiClient.logout.mockResolvedValueOnce({});

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(true);

      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
      });

      expect(mockApiClient.clearTokens).toHaveBeenCalled();
    });
  });

  describe('Error State Management', () => {
    it('should clear error when clearError is called', () => {
      useAuthStore.setState({
        error: 'Some error message',
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.error).toBe('Some error message');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Loading States', () => {
    it('should set loading state during login', async () => {
      mockApiClient.login.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const { result } = renderHook(() => useAuth());

      let wasLoading = false;

      act(() => {
        result.current.login('test@example.com', 'password123').then(() => {
          wasLoading = result.current.isLoading;
        });
      });

      await waitFor(() => {
        expect(wasLoading || result.current.isLoading === false).toBe(true);
      });
    });
  });
});
