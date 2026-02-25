import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createAuthSlice } from "./auth/auth.slice";
import { createProjectsSlice } from "./projects/projectsSlice";
import { createSearchSlice, loadPersistedSearchData } from "./search/searchSlice";
import type { AuthSlice } from "./auth/auth.types";
import type { ProjectsSlice } from "./projects/projects.types";
import type { SearchSlice } from "./search/search.types";
import { setAuthToken } from "@/lib/api/axios";

// Unified store state type
export type StoreState = AuthSlice & ProjectsSlice & SearchSlice;

export const useStore = create<StoreState>()(
  persist(
    (...args) => ({
      ...createAuthSlice(...args),
      ...createProjectsSlice(...args),
      ...createSearchSlice(...args),
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
    }
  )
);
