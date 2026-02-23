// TypeScript interfaces for the Projects domain

export interface Project {
  id: string; // UUID
  name: string;
  type: string;
  location: string;
  area: number;
  start_date: string; // ISO timestamp
  farmers: number;
  carbon_credits: number;
  progress: number;
  icon: string;
  status: 'active' | 'pending' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateRequest {
  name: string;
  type: string;
  location: string;
  area: number;
  start_date?: string; // YYYY-MM-DD
  farmers?: number;
  carbon_credits?: number;
  progress?: number;
  icon?: string;
  status?: string;
}

export interface ProjectUpdateRequest {
  name?: string;
  type?: string;
  location?: string;
  area?: number;
  start_date?: string;
  farmers?: number;
  carbon_credits?: number;
  progress?: number;
  icon?: string;
  status?: string;
}

export interface PaginationState {
  limit: number;
  offset: number;
  total: number;
}

export interface ProjectFilters {
  status: string; // 'All' | 'active' | 'pending' | 'completed'
  type: string;   // 'All' | specific type
  search: string;
}

export interface ProjectStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalCarbonCredits: number;
  totalArea: number;
  totalFarmers: number;
  averageProgress: number;
}

export interface ProjectsLoadingState {
  isFetching: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

export interface ProjectsErrorState {
  fetch: string | null;
  create: string | null;
  update: string | null;
  delete: string | null;
}

export interface ProjectsSlice {
  // State
  projects: Project[];
  selectedProject: Project | null;
  loading: ProjectsLoadingState;
  errors: ProjectsErrorState;
  pagination: PaginationState;
  filters: ProjectFilters;

  // CRUD Actions
  fetchProjects: (limit?: number, offset?: number) => Promise<void>;
  fetchProjectById: (id: string) => Promise<void>;
  createProject: (data: ProjectCreateRequest) => Promise<Project | null>;
  updateProject: (id: string, data: ProjectUpdateRequest) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<boolean>;

  // UI State Actions
  setSelectedProject: (project: Project) => void;
  clearSelectedProject: () => void;
  clearProjectErrors: () => void;
  resetProjectsState: () => void;
  setFilters: (filters: Partial<ProjectFilters>) => void;
}
