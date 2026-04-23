import { create } from 'zustand';
import { apiClient } from './api-client';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyId: string;
  role: string;
  emailVerified: boolean;
  isActive: boolean;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  getCurrentUser: () => Promise<void>;
  clearError: () => void;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,
  isAuthenticated: apiClient.isAuthenticated(),

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.login(email, password);
      const { accessToken, refreshToken, user } = response;

      apiClient.setTokens(accessToken, refreshToken);
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      const message = error.message || 'Login failed';
      set({
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },

  register: async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName: string;
  }) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.register(data);
      const { accessToken, refreshToken, user } = response;

      apiClient.setTokens(accessToken, refreshToken);
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      const message = error.message || 'Registration failed';
      set({
        error: message,
        isLoading: false,
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await apiClient.logout(refreshToken);
      }
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error: any) {
      // Clear state even if logout fails on backend
      apiClient.clearTokens();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  getCurrentUser: async () => {
    if (!apiClient.isAuthenticated()) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.getCurrentUser();
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      apiClient.clearTokens();
      set({
        user: null,
        isAuthenticated: false,
        error: error.message,
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),

  setUser: (user: User | null) => set({ user }),
}));
