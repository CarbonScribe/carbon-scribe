import type { StateCreator } from "zustand";
import type { AuthState, RegisterPayload } from "./auth.types";
import { loginApi, registerApi, pingApi } from "@/lib/api/auth.api";
import { setAuthToken, setOnUnauthorized } from "@/lib/api/axios";

export type StoreState = AuthState;

export const createAuthSlice: StateCreator<
  StoreState,
  [["zustand/persist", unknown]],
  [],
  AuthState
> = (set, get) => {
  // hook axios 401 -> logout
  setOnUnauthorized(() => get().logout());

  return {
    user: null,
    token: null,
    isAuthenticated: false,

    isHydrated: false,
    loading: { login: false, register: false, refresh: false },
    error: null,

    setHydrated: (v) => set({ isHydrated: v }),

    clearError: () => set({ error: null }),

    login: async (email, password) => {
      set((s) => ({ loading: { ...s.loading, login: true }, error: null }));
      try {
        const { token, user } = await loginApi({ email, password });
        setAuthToken(token);
        set({
          token,
          user,
          isAuthenticated: true,
          loading: { ...get().loading, login: false },
        });
      } catch (e: any) {
        const msg = e?.response?.data?.error || e?.message || "Login failed";
        console.log("Login error:", msg);
        set((s) => ({ loading: { ...s.loading, login: false }, error: msg }));
        throw e;
      }
    },

    register: async (data: RegisterPayload) => {
      set((s) => ({ loading: { ...s.loading, register: true }, error: null }));
      try {
        const res: any = await registerApi(data);

        // If backend returns token+user, auto-authenticate.
        if (res?.token && res?.user) {
          setAuthToken(res.token);
          set({
            token: res.token,
            user: res.user,
            isAuthenticated: true,
            loading: { ...get().loading, register: false },
          });
          return;
        }

        // Otherwise: registration succeeded, but you still need to login
        set((s) => ({ loading: { ...s.loading, register: false } }));
      } catch (e: any) {
        const msg =
          e?.response?.data?.error || e?.message || "Registration failed";
        console.log("Registration error:", msg);
        set((s) => ({
          loading: { ...s.loading, register: false },
          error: msg,
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
        error: null,
        loading: { login: false, register: false, refresh: false },
      });
      // hard redirect to avoid protected UI flashing
      if (typeof window !== "undefined") window.location.href = "/login";
    },

    refreshToken: async () => {
      const token = get().token;
      if (!token) return;

      set((s) => ({ loading: { ...s.loading, refresh: true } }));
      try {
        setAuthToken(token);
        await pingApi(); // should 401 if invalid/expired
        set((s) => ({
          isAuthenticated: true,
          loading: { ...s.loading, refresh: false },
        }));
      } catch {
        set((s) => ({ loading: { ...s.loading, refresh: false } }));
        get().logout();
      }
    },
  };
};
