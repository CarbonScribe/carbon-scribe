import type { StateCreator } from "zustand";
import type { StoreState } from "../store";
import type { RegisterPayload, AuthSlice } from "./auth.types";
import { loginApi, registerApi, pingApi } from "@/lib/api/auth.api";
import { setAuthToken, setOnUnauthorized } from "@/lib/api/axios";

export const createAuthSlice: StateCreator<
  StoreState,
  [],
  [],
  AuthSlice
> = (set, get) => {
  setOnUnauthorized(() => get().logout());

  return {
    user: null,
    token: null,
    isAuthenticated: false,

    isHydrated: false,
    authLoading: { login: false, register: false, refresh: false },
    authError: null,

    setHydrated: (v) => set({ isHydrated: v }),

    clearError: () => set({ authError: null }),

    login: async (email, password) => {
      set((s) => ({
        authLoading: { ...s.authLoading, login: true },
        authError: null,
      }));
      try {
        const { token, user } = await loginApi({ email, password });
        setAuthToken(token);
        set({
          token,
          user,
          isAuthenticated: true,
          authLoading: { ...get().authLoading, login: false },
        });
      } catch (e: any) {
        const msg = e?.response?.data?.error || e?.message || "Login failed";
        set((s) => ({
          authLoading: { ...s.authLoading, login: false },
          authError: msg,
        }));
        throw e;
      }
    },

    register: async (data: RegisterPayload) => {
      set((s) => ({
        authLoading: { ...s.authLoading, register: true },
        authError: null,
      }));
      try {
        const res: any = await registerApi(data);

        if (res?.token && res?.user) {
          setAuthToken(res.token);
          set({
            token: res.token,
            user: res.user,
            isAuthenticated: true,
            authLoading: { ...get().authLoading, register: false },
          });
          return;
        }

        set((s) => ({ authLoading: { ...s.authLoading, register: false } }));
      } catch (e: any) {
        const msg =
          e?.response?.data?.error || e?.message || "Registration failed";
        set((s) => ({
          authLoading: { ...s.authLoading, register: false },
          authError: msg,
        }));
        throw e;
      }
    },

    logout: () => {
      setAuthToken(null);
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        authError: null,
        authLoading: { login: false, register: false, refresh: false },
      });
      if (typeof window !== "undefined") window.location.href = "/login";
    },

    refreshToken: async () => {
      const token = get().token;
      if (!token) return;

      set((s) => ({ authLoading: { ...s.authLoading, refresh: true } }));
      try {
        setAuthToken(token);
        await pingApi();
        set((s) => ({
          isAuthenticated: true,
          authLoading: { ...s.authLoading, refresh: false },
        }));
      } catch {
        set((s) => ({ authLoading: { ...s.authLoading, refresh: false } }));
        get().logout();
      }
    },
  };
};
