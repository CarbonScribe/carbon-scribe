import { setAuthToken, setUserIdGetter } from "@/lib/api/axios";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createAuthSlice } from "./auth/auth.slice";
import type { AuthSlice } from "./auth/auth.types";
import type { CollaborationSlice } from "./collaboration/collaboration.types";
import { createCollaborationSlice } from "./collaboration/collaborationSlice";
import type { HealthSlice } from "./health/health.types";
import { createHealthSlice } from "./health/healthSlice";
import type { ProjectsSlice } from "./projects/projects.types";
import { createProjectsSlice } from "./projects/projectsSlice";
import type { SearchSlice } from "./search/search.types";
import {
  createSearchSlice,
  loadPersistedSearchData,
} from "./search/searchSlice";

// Unified store state type
export type StoreState = AuthSlice &
  ProjectsSlice &
  CollaborationSlice &
  SearchSlice &
  HealthSlice;

// Helper to check if token is expired or about to expire (60s buffer)
const isTokenExpiringSoon = (expiresIn: number | null): boolean => {
  if (!expiresIn) return true;
  // If token expires in less than 60 seconds, consider it expired
  return expiresIn <= 60;
};

export const useStore = create<StoreState>()(
  persist(
    (...args) => ({
      ...createAuthSlice(...args),
      ...createProjectsSlice(...args),
      ...createCollaborationSlice(...args),
      ...createSearchSlice(...args),
      ...createHealthSlice(...args),
    }),
    {
      name: "project-portal-store",
      partialize: (s) => ({
        token: s.token,
        refreshToken: s.refreshToken,
        expiresIn: s.expiresIn,
        tokenType: s.tokenType,
        user: s.user,
        isAuthenticated: s.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        const token = state?.token ?? null;
        setAuthToken(token);
        state?.setHydrated?.(true);

        // Set up user ID getter for X-User-ID header
        setUserIdGetter(() => state?.user?.id ?? null);

        // Initialize search-specific persisted data if any
        if (typeof window !== "undefined") {
          const persistedSearchData = loadPersistedSearchData();
          if (Object.keys(persistedSearchData).length > 0) {
            useStore.setState((s) => ({
              ...s,
              ...persistedSearchData,
            }));
          }

         
          const path = window.location.pathname;
          const isAuthPage = path === "/login" || path === "/register";
          const isAuthenticated = state?.isAuthenticated === true;
          const expiresIn = state?.expiresIn ?? null;
          const shouldRefresh = !isAuthPage && isAuthenticated && isTokenExpiringSoon(expiresIn);

          if (shouldRefresh) {
            state?.refreshSession?.().catch((error) => {
              // Silent fail - don't show toast here, let the auth slice handle it
              console.debug("[Store] Auto-refresh failed:", error?.message);
            });
          }
        }
      },
    },
  ),
);

