import { setAuthToken } from "@/lib/api/axios";
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
        user: s.user,
        isAuthenticated: s.isAuthenticated,
        // search data is handled separately in its slice's loadPersistedSearchData but we can include it here if needed
      }),
      onRehydrateStorage: () => (state) => {
        const token = state?.token ?? null;
        setAuthToken(token);
        state?.setHydrated?.(true);

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
          if (path !== "/login" && path !== "/register") {
            state?.refreshToken?.();
          }
        }
      },
    },
  ),
);
