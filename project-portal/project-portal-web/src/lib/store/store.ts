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
import type { NotificationsSlice } from "@/store/notification.types";
import { createNotificationsSlice } from "@/store/notificationsSlice";
import type { FinancingSlice } from "./financing/financing.types";
import { createFinancingSlice } from "./financing/financingSlice";
import type { GeospatialSlice } from "./geospatial/geospatial.types";
import { createGeospatialSlice } from "./geospatial/geospatialSlice";

// Unified store state type
export type StoreState = AuthSlice &
  ProjectsSlice &
  CollaborationSlice &
  SearchSlice &
  HealthSlice &
  NotificationsSlice &
  FinancingSlice &
  GeospatialSlice;

// Helper to check if token is expired or about to expire (60s buffer)
const isTokenExpiringSoon = (expiresIn: number | null): boolean => {
  if (!expiresIn) return true;
  // If token expires in less than 60 seconds, consider it expired
  return expiresIn <= 60;
};

export const useStore = create<StoreState>()(
  persist(
    (...args: [any, any, any]) => ({
      ...createAuthSlice(...args),
      ...createProjectsSlice(...args),
      ...createCollaborationSlice(...args),
      ...createSearchSlice(...args),
      ...createHealthSlice(...args),
      ...createNotificationsSlice(...args),
      ...createFinancingSlice(...args),
      ...createGeospatialSlice(...args),
    }),
    {
      name: "project-portal-store",
      partialize: (s: StoreState) => ({
        token: s.token,
        refreshToken: s.refreshToken,
        expiresIn: s.expiresIn,
        tokenType: s.tokenType,
        user: s.user,
        isAuthenticated: s.isAuthenticated,
      }),
      onRehydrateStorage: () => (state?: StoreState) => {
        const token = state?.token ?? null;
        setAuthToken(token);
        state?.setHydrated?.(true);

        // Set up user ID getter for X-User-ID header
        setUserIdGetter(() => state?.user?.id ?? null);

        // Initialize search-specific persisted data if any
        if (typeof window !== "undefined") {
          const persistedSearchData = loadPersistedSearchData();
          if (Object.keys(persistedSearchData).length > 0) {
            useStore.setState((s: StoreState) => ({
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
            state?.refreshSession?.().catch((error: unknown) => {
              // Silent fail - don't show toast here, let the auth slice handle it
              const message =
                error instanceof Error
                  ? error.message
                  : String((error as any)?.message ?? error);
              console.debug("[Store] Auto-refresh failed:", message);
            });
          }
        }
      },
    },
  ),
);

