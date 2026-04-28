import type { StateCreator } from "zustand";
import type { StoreState } from "../store";
import type { RegisterPayload, AuthSlice } from "./auth.types";
import { getProfileApi, loginApi, logoutApi, refreshApi, registerApi, normalizeUser } from "@/lib/api/auth.api";
import { setAuthToken, setOnUnauthorized } from "@/lib/api/axios";

const INITIAL_AUTH_STATE = {
  token: null,
  refreshToken: null,
  expiresIn: null,
  tokenType: "Bearer",
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  authError: null,
  authLoading: {
    login: false,
    register: false,
    refresh: false,
    profile: false,
    logout: false,
  },
};

const isTokenExpired = (expiresIn: number | null): boolean => {
  if (!expiresIn) return true;
  // Add 30-second buffer to avoid edge cases
  return expiresIn <= 30;
};

export const createAuthSlice: StateCreator<StoreState, [], [], AuthSlice> = (set, get) => {
  const clearAuthState = () => {
    setAuthToken(null);
    set(INITIAL_AUTH_STATE);
  };

  // Handle 401 responses globally
  setOnUnauthorized(() => {
    const { isAuthenticated, refreshSession } = get();
    
    if (isAuthenticated) {
      // Try to refresh before giving up
      refreshSession().catch(() => {
        clearAuthState();
        redirectToLogin();
      });
    } else {
      clearAuthState();
      redirectToLogin();
    }
  });

  const redirectToLogin = () => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (!["/login", "/register"].includes(path)) {
        window.location.replace(`/login?next=${encodeURIComponent(path)}`);
      }
    }
  };

  const setAuthState = (data: {
    token: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
    user: any;
  }) => {
    setAuthToken(data.token);
    set({
      ...data,
      isAuthenticated: true,
      isHydrated: true,
      authError: null,
    });
  };

  return {
    ...INITIAL_AUTH_STATE,

    setHydrated: (hydrated) => set({ isHydrated: hydrated }),

    clearError: () => set({ authError: null }),

    login: async (email, password) => {
      set((s) => ({
        authLoading: { ...s.authLoading, login: true },
        authError: null,
      }));

      try {
        const response = await loginApi({ email, password });
        const { access_token, refresh_token, expires_in, token_type, user } = response;

        const normalizedUser = user?.id ? user : normalizeUser(user);

        setAuthState({
          token: access_token,
          refreshToken: refresh_token,
          expiresIn: expires_in,
          tokenType: token_type ?? "Bearer",
          user: normalizedUser,
        });

        // Optional: Pre-fetch fresh profile
        await get().fetchProfile();

        set((s) => ({ authLoading: { ...s.authLoading, login: false } }));
      } catch (error: any) {
        const message = error?.response?.data?.error || error?.message || "Login failed";
        set((s) => ({
          authLoading: { ...s.authLoading, login: false },
          authError: message,
        }));
        throw error;
      }
    },

    register: async (data: RegisterPayload) => {
      set((s) => ({
        authLoading: { ...s.authLoading, register: true },
        authError: null,
      }));

      try {
        const response = await registerApi(data);
        set((s) => ({ authLoading: { ...s.authLoading, register: false } }));
        return response;
      } catch (error: any) {
        const message = error?.response?.data?.error || error?.message || "Registration failed";
        set((s) => ({
          authLoading: { ...s.authLoading, register: false },
          authError: message,
        }));
        throw error;
      }
    },

    logout: async () => {
      set((s) => ({ authLoading: { ...s.authLoading, logout: true } }));

      try {
        const { token } = get();
        if (token) {
          await logoutApi();
        }
      } catch (error) {
        // Swallow logout API errors — session is cleared regardless
      } finally {
        clearAuthState();
        set((s) => ({ authLoading: { ...s.authLoading, logout: false } }));
      }
    },

    refreshSession: async () => {
      const { refreshToken, isAuthenticated } = get();

      if (!refreshToken) {
        if (isAuthenticated) clearAuthState();
        return;
      }

      // Prevent multiple concurrent refresh attempts
      if (get().authLoading.refresh) return;

      set((s) => ({ authLoading: { ...s.authLoading, refresh: true } }));

      try {
        const refreshed = await refreshApi(refreshToken);

        setAuthToken(refreshed.access_token);

        set((s) => ({
          token: refreshed.access_token,
          refreshToken: refreshed.refresh_token ?? s.refreshToken,
          expiresIn: refreshed.expires_in,
          tokenType: refreshed.token_type ?? s.tokenType,
          isAuthenticated: true,
          isHydrated: true,
          authLoading: { ...s.authLoading, refresh: false },
        }));

        // Refresh profile after token refresh
        await get().fetchProfile();
      } catch (error) {
        clearAuthState();
        throw error;
      } finally {
        set((s) => ({ authLoading: { ...s.authLoading, refresh: false } }));
      }
    },

    fetchProfile: async () => {
      const { token, isAuthenticated } = get();

      if (!token || !isAuthenticated) {
        clearAuthState();
        return;
      }

      set((s) => ({ authLoading: { ...s.authLoading, profile: true } }));

      try {
        setAuthToken(token);
        const userRaw = await getProfileApi();
        const user = userRaw?.id ? userRaw : normalizeUser(userRaw);

        set((s) => ({
          user,
          isAuthenticated: true,
          isHydrated: true,
          authLoading: { ...s.authLoading, profile: false },
        }));
      } catch (error: any) {
        // If profile fetch fails with 401, token might be invalid
        if (error?.response?.status === 401) {
          await get().refreshSession();
        } else {
          const message = error?.response?.data?.error || error?.message || "Failed to load profile";
          set((s) => ({
            authLoading: { ...s.authLoading, profile: false },
            authError: message,
          }));
        }
      }
    },
  };
};

