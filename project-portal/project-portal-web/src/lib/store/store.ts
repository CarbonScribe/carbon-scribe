import { create } from "zustand";
import { persist } from "zustand/middleware";

import { createAuthSlice } from "./auth/auth.slice";
import type { AuthSlice } from "./auth/auth.types";

import { createProjectsSlice } from "./projects/projectsSlice";
import type { ProjectsSlice } from "./projects/projects.types";

import { setAuthToken } from "@/lib/api/axios";

export type StoreState = AuthSlice & ProjectsSlice;

export const useStore = create<StoreState>()(
  persist(
    (...args) => ({
      ...createAuthSlice(...args),
      ...createProjectsSlice(...args),
    }),
    {
      name: "project-portal-store",
      partialize: (s) => ({
        token: s.token,
        user: s.user,
        isAuthenticated: s.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        const token = state?.token ?? null;
        setAuthToken(token);
        state?.setHydrated?.(true);

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
