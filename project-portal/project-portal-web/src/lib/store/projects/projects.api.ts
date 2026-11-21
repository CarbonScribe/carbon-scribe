import apiClient from '@/lib/api/apiClient';
import type {
  Project,
  ProjectCreateRequest,
  ProjectFilters,
  ProjectUpdateRequest,
} from './projects.types';

interface ListProjectsResponse {
  projects: Project[];
}

export async function fetchProjectsApi(
  limit: number = 10,
  offset: number = 0,
  filters: ProjectFilters = { search: '', type: 'All', status: 'All' },
  signal?: AbortSignal
): Promise<{ projects: Project[] }> {
  const params: Record<string, string | number> = { limit, offset };
  if (filters.search.trim()) params.search = filters.search.trim();
  if (filters.type !== 'All') params.type = filters.type;
  if (filters.status !== 'All') params.status = filters.status;

  const response = await apiClient.get<ListProjectsResponse>('/projects', {
    params,
    signal,
  });
  return { projects: response.data.projects || [] };
}

export async function fetchProjectByIdApi(id: string): Promise<Project> {
  const response = await apiClient.get<Project>(`/projects/${id}`);
  return response.data;
}

export async function createProjectApi(data: ProjectCreateRequest): Promise<Project> {
  const response = await apiClient.post<Project>('/projects', data);
  return response.data;
}

export async function updateProjectApi(
  id: string,
  data: ProjectUpdateRequest
): Promise<Project> {
  const response = await apiClient.put<Project>(`/projects/${id}`, data);
  return response.data;
}

export async function deleteProjectApi(id: string): Promise<void> {
  await apiClient.delete(`/projects/${id}`);
}
