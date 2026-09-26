import { StateCreator } from 'zustand';
import type { ProjectsSlice, Project } from './projects.types';
import {
  fetchProjectsApi,
  fetchProjectByIdApi,
  createProjectApi,
  updateProjectApi,
  deleteProjectApi,
} from './projects.api';
import { getErrorMessage } from '@/lib/utils/errorMessage';
import { showSuccessToast, showErrorToast } from '@/lib/utils/toast';
import { makeProjectsCacheKey, isCacheEntryStale } from './projects.cache';

const initialState = {
  projects: [] as Project[],
  selectedProject: null as Project | null,
  loading: {
    isFetching: false,
    isRefreshing: false,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
  },
  errors: {
    fetch: null as string | null,
    create: null as string | null,
    update: null as string | null,
    delete: null as string | null,
  },
  pagination: {
    limit: 10,
    offset: 0,
    total: 0,
  },
  filters: {
    status: 'All',
    type: 'All',
    search: '',
  },
  projectsCache: {} as Record<string, { projects: Project[]; fetchedAt: number }>,
  lastFetchedAt: null as number | null,
};

export const createProjectsSlice: StateCreator<ProjectsSlice> = (set, get) => ({
  ...initialState,

  // Fetch all projects (paginated, stale-while-revalidate)
  fetchProjects: async (limit?: number, offset?: number, options?: { force?: boolean }) => {
    const pag = get().pagination;
    const fetchLimit = limit ?? pag.limit;
    const fetchOffset = offset ?? pag.offset;
    const force = options?.force ?? false;
    const key = makeProjectsCacheKey(fetchLimit, fetchOffset);
    const cached = get().projectsCache[key];

    if (cached && !force) {
      set((state) => ({
        projects: cached.projects,
        pagination: { limit: fetchLimit, offset: fetchOffset, total: cached.projects.length },
        lastFetchedAt: cached.fetchedAt,
        errors: { ...state.errors, fetch: null },
      }));

      if (isCacheEntryStale(cached)) {
        void get()._refreshProjectsInBackground(fetchLimit, fetchOffset, key);
      }
      return;
    }

    set((state) => ({
      loading: { ...state.loading, isFetching: true },
      errors: { ...state.errors, fetch: null },
    }));

    try {
      const { projects } = await fetchProjectsApi(fetchLimit, fetchOffset);
      const fetchedAt = Date.now();
      set((state) => ({
        projects,
        pagination: { limit: fetchLimit, offset: fetchOffset, total: projects.length },
        lastFetchedAt: fetchedAt,
        projectsCache: { ...state.projectsCache, [key]: { projects, fetchedAt } },
        loading: { ...state.loading, isFetching: false },
      }));
    } catch (error: unknown) {
      set((state) => ({
        loading: { ...state.loading, isFetching: false },
        errors: { ...state.errors, fetch: getErrorMessage(error) },
      }));
    }
  },

  // Background refresh for stale cache entries (no skeleton)
  _refreshProjectsInBackground: async (limit: number, offset: number, key: string) => {
    set((state) => ({ loading: { ...state.loading, isRefreshing: true } }));

    try {
      const { projects } = await fetchProjectsApi(limit, offset);
      const fetchedAt = Date.now();
      const pag = get().pagination;
      const isCurrentPage = pag.limit === limit && pag.offset === offset;

      set((state) => ({
        projectsCache: { ...state.projectsCache, [key]: { projects, fetchedAt } },
        ...(isCurrentPage ? { projects, lastFetchedAt: fetchedAt } : {}),
        loading: { ...state.loading, isRefreshing: false },
      }));
    } catch {
      set((state) => ({ loading: { ...state.loading, isRefreshing: false } }));
    }
  },

  // Manual refresh: always a full reload with loading state
  refreshProjects: async () => {
    const pag = get().pagination;
    await get().fetchProjects(pag.limit, pag.offset, { force: true });
  },

  invalidateProjectsCache: () => {
    set({ projectsCache: {}, lastFetchedAt: null });
  },

  // Fetch single project by ID
  fetchProjectById: async (id: string) => {
    set((state) => ({
      loading: { ...state.loading, isFetching: true },
      errors: { ...state.errors, fetch: null },
    }));

    try {
      const project = await fetchProjectByIdApi(id);
      set((state) => ({
        selectedProject: project,
        loading: { ...state.loading, isFetching: false },
      }));
    } catch (error: unknown) {
      set((state) => ({
        loading: { ...state.loading, isFetching: false },
        errors: { ...state.errors, fetch: getErrorMessage(error) },
      }));
    }
  },

  // Create project
  createProject: async (data) => {
    set((state) => ({
      loading: { ...state.loading, isCreating: true },
      errors: { ...state.errors, create: null },
    }));

    try {
      const newProject = await createProjectApi(data);
      set((state) => ({
        projects: [newProject, ...state.projects],
        loading: { ...state.loading, isCreating: false },
      }));
      get().invalidateProjectsCache();

      showSuccessToast('Project created successfully', {
        description: data.name ? `"${data.name}" has been created` : undefined,
      });

      return newProject;
    } catch (error: unknown) {
      set((state) => ({
        loading: { ...state.loading, isCreating: false },
        errors: { ...state.errors, create: getErrorMessage(error) },
      }));

      showErrorToast('Failed to create project', {
        description: 'Please check your input and try again.',
      });

      return null;
    }
  },

  // Update project
  updateProject: async (id, data) => {
    set((state) => ({
      loading: { ...state.loading, isUpdating: true },
      errors: { ...state.errors, update: null },
    }));

    try {
      const updatedProject = await updateProjectApi(id, data);
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? updatedProject : p)),
        selectedProject:
          state.selectedProject?.id === id ? updatedProject : state.selectedProject,
        loading: { ...state.loading, isUpdating: false },
      }));
      get().invalidateProjectsCache();

      showSuccessToast('Project updated successfully', {
        description: data.name ? `"${data.name}" has been updated` : undefined,
      });

      return updatedProject;
    } catch (error: unknown) {
      set((state) => ({
        loading: { ...state.loading, isUpdating: false },
        errors: { ...state.errors, update: getErrorMessage(error) },
      }));

      showErrorToast('Failed to update project', {
        description: 'Please try again or contact support.',
      });

      return null;
    }
  },

  // Delete project
  deleteProject: async (id) => {
    set((state) => ({
      loading: { ...state.loading, isDeleting: true },
      errors: { ...state.errors, delete: null },
    }));

    try {
      await deleteProjectApi(id);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        selectedProject: state.selectedProject?.id === id ? null : state.selectedProject,
        loading: { ...state.loading, isDeleting: false },
      }));
      get().invalidateProjectsCache();

      showSuccessToast('Project deleted successfully');

      return true;
    } catch (error: unknown) {
      set((state) => ({
        loading: { ...state.loading, isDeleting: false },
        errors: { ...state.errors, delete: getErrorMessage(error) },
      }));

      showErrorToast('Failed to delete project', {
        description: 'Please try again or contact support.',
      });

      return false;
    }
  },

  // UI State Actions
  setSelectedProject: (project) => set({ selectedProject: project }),
  clearSelectedProject: () => set({ selectedProject: null }),

  clearProjectErrors: () =>
    set({
      errors: { fetch: null, create: null, update: null, delete: null },
    }),

  resetProjectsState: () => set({ ...initialState }),

  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),
});