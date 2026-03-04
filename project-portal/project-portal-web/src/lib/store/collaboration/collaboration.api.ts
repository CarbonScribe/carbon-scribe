import apiClient from '@/lib/api/apiClient';
import type {
  ProjectMember,
  ProjectInvitation,
  ActivityLog,
  Comment,
  Task,
  SharedResource,
  InviteUserRequest,
  CreateCommentRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
  CreateResourceRequest,
} from './collaboration.types';

const BASE = '/collaboration';

export async function fetchMembersApi(projectId: string): Promise<ProjectMember[]> {
  const { data } = await apiClient.get<ProjectMember[]>(`${BASE}/projects/${projectId}/members`);
  return Array.isArray(data) ? data : [];
}

export async function fetchInvitationsApi(projectId: string): Promise<ProjectInvitation[]> {
  const { data } = await apiClient.get<ProjectInvitation[]>(`${BASE}/projects/${projectId}/invitations`);
  return Array.isArray(data) ? data : [];
}

export async function fetchActivitiesApi(
  projectId: string,
  limit = 20,
  offset = 0
): Promise<ActivityLog[]> {
  const { data } = await apiClient.get<ActivityLog[]>(`${BASE}/projects/${projectId}/activities`, {
    params: { limit, offset },
  });
  return Array.isArray(data) ? data : [];
}

export async function fetchCommentsApi(projectId: string): Promise<Comment[]> {
  const { data } = await apiClient.get<Comment[]>(`${BASE}/projects/${projectId}/comments`);
  return Array.isArray(data) ? data : [];
}

export async function fetchTasksApi(projectId: string): Promise<Task[]> {
  const { data } = await apiClient.get<Task[]>(`${BASE}/projects/${projectId}/tasks`);
  return Array.isArray(data) ? data : [];
}

export async function fetchResourcesApi(projectId: string): Promise<SharedResource[]> {
  const { data } = await apiClient.get<SharedResource[]>(`${BASE}/projects/${projectId}/resources`);
  return Array.isArray(data) ? data : [];
}

export async function inviteUserApi(
  projectId: string,
  body: InviteUserRequest
): Promise<ProjectInvitation> {
  const { data } = await apiClient.post<ProjectInvitation>(`${BASE}/projects/${projectId}/invite`, body);
  return data;
}

export async function removeMemberApi(projectId: string, userId: string): Promise<void> {
  await apiClient.delete(`${BASE}/projects/${projectId}/members/${userId}`);
}

export async function createCommentApi(body: CreateCommentRequest): Promise<Comment> {
  const { data } = await apiClient.post<Comment>(`${BASE}/comments`, body);
  return data;
}

export async function createTaskApi(body: CreateTaskRequest): Promise<Task> {
  const { data } = await apiClient.post<Task>(`${BASE}/tasks`, body);
  return data;
}

export async function updateTaskApi(taskId: string, body: UpdateTaskRequest): Promise<Task> {
  const { data } = await apiClient.patch<Task>(`${BASE}/tasks/${taskId}`, body);
  return data;
}

export async function createResourceApi(body: CreateResourceRequest): Promise<SharedResource> {
  const { data } = await apiClient.post<SharedResource>(`${BASE}/resources`, body);
  return data;
}
