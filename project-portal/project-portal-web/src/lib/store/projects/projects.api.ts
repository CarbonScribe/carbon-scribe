import apiClient from '@/lib/api/apiClient';
import type { Project, ProjectCreateRequest, ProjectUpdateRequest } from './projects.types';

interface ListProjectsResponse {
  projects: Project[];
}

export async function fetchProjectsApi(
  limit: number = 10,
  offset: number = 0
): Promise<{ projects: Project[] }> {
  const response = await apiClient.get<ListProjectsResponse>('/projects', {
    params: { limit, offset },
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
