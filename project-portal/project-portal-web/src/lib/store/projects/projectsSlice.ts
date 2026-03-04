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

const initialState = {
  projects: [] as Project[],
  selectedProject: null as Project | null,
  loading: {
    isFetching: false,
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
};

export const createProjectsSlice: StateCreator<ProjectsSlice> = (set, get) => ({
  ...initialState,

  // ── Fetch all projects (paginated) ──
  fetchProjects: async (limit?: number, offset?: number) => {
    const pag = get().pagination;
    const fetchLimit = limit ?? pag.limit;
    const fetchOffset = offset ?? pag.offset;

    set((state) => ({
      loading: { ...state.loading, isFetching: true },
      errors: { ...state.errors, fetch: null },
    }));

    try {
      const { projects } = await fetchProjectsApi(fetchLimit, fetchOffset);
      set({
        projects,
        pagination: {
          limit: fetchLimit,
          offset: fetchOffset,
          total: projects.length, // Backend doesn't return total count yet
        },
        loading: { ...get().loading, isFetching: false },
      });
    } catch (error: unknown) {
      set({
        loading: { ...get().loading, isFetching: false },
        errors: { ...get().errors, fetch: getErrorMessage(error) },
      });
    }
  },

  // ── Fetch single project by ID ──
  fetchProjectById: async (id: string) => {
    set((state) => ({
      loading: { ...state.loading, isFetching: true },
      errors: { ...state.errors, fetch: null },
    }));

    try {
      const project = await fetchProjectByIdApi(id);
      set({
        selectedProject: project,
        loading: { ...get().loading, isFetching: false },
      });
    } catch (error: unknown) {
      set({
        loading: { ...get().loading, isFetching: false },
        errors: { ...get().errors, fetch: getErrorMessage(error) },
      });
    }
  },

  // ── Create project ──
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
      return newProject;
    } catch (error: unknown) {
      set({
        loading: { ...get().loading, isCreating: false },
        errors: { ...get().errors, create: getErrorMessage(error) },
      });
      return null;
    }
  },

  // ── Update project ──
  updateProject: async (id, data) => {
    set((state) => ({
      loading: { ...state.loading, isUpdating: true },
      errors: { ...state.errors, update: null },
    }));

    try {
      const updatedProject = await updateProjectApi(id, data);
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? updatedProject : p
        ),
        selectedProject:
          state.selectedProject?.id === id ? updatedProject : state.selectedProject,
        loading: { ...state.loading, isUpdating: false },
      }));
      return updatedProject;
    } catch (error: unknown) {
      set({
        loading: { ...get().loading, isUpdating: false },
        errors: { ...get().errors, update: getErrorMessage(error) },
      });
      return null;
    }
  },

  // ── Delete project ──
  deleteProject: async (id) => {
    set((state) => ({
      loading: { ...state.loading, isDeleting: true },
      errors: { ...state.errors, delete: null },
    }));

    try {
      await deleteProjectApi(id);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        selectedProject:
          state.selectedProject?.id === id ? null : state.selectedProject,
        loading: { ...state.loading, isDeleting: false },
      }));
      return true;
    } catch (error: unknown) {
      set({
        loading: { ...get().loading, isDeleting: false },
        errors: { ...get().errors, delete: getErrorMessage(error) },
      });
      return false;
    }
  },

  // ── UI State Actions ──
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
