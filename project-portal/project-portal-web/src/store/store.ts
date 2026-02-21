import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createAuthSlice } from "./auth/auth.slice";
import { setAuthToken } from "@/lib/api/axios";

export const useStore = create<any>()(
  persist(
    (...a) => ({
      ...createAuthSlice(...a),
    }),
    {
      name: "project-portal-store",
      partialize: (s: any) => ({
        token: s.token,
        user: s.user,
        isAuthenticated: s.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        const token = state?.token ?? null;
        setAuthToken(token);
        state?.setHydrated(true);
        state?.refreshToken?.();
        if (typeof window !== "undefined") {
          const path = window.location.pathname;
          if (path !== "/login" && path !== "/register") {
            state?.refreshToken?.();
          }
        }
      },
    },
  ),
);
