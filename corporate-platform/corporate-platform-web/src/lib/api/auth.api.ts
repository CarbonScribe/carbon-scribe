import { apiRequest, ApiError } from './http';
import type {
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
  RefreshResponse,
  AuthUser,
} from '@/types/auth.types';

const AUTH_PREFIX = '/api/v1/auth';

export async function loginApi(payload: LoginCredentials): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>(`${AUTH_PREFIX}/login`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response;
}

export async function registerApi(payload: RegisterCredentials): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>(`${AUTH_PREFIX}/register`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response;
}

export async function refreshApi(refreshToken: string): Promise<RefreshResponse> {
  const response = await apiRequest<RefreshResponse>(`${AUTH_PREFIX}/refresh`, {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  return response;
}

export async function logoutApi(refreshToken: string): Promise<void> {
  await apiRequest(`${AUTH_PREFIX}/logout`, {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export async function getProfileApi(token: string): Promise<AuthUser> {
  const response = await apiRequest<{ user: AuthUser }>(`${AUTH_PREFIX}/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.user;
}

export async function changePasswordApi(
  token: string,
  payload: { currentPassword: string; newPassword: string }
): Promise<{ success: boolean }> {
  const response = await apiRequest<{ success: boolean }>(`${AUTH_PREFIX}/change-password`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response;
}

export async function forgotPasswordApi(email: string): Promise<{ message: string }> {
  const response = await apiRequest<{ message: string }>(`${AUTH_PREFIX}/forgot-password`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return response;
}

export async function resetPasswordApi(
  token: string,
  newPassword: string
): Promise<{ success: boolean }> {
  const response = await apiRequest<{ success: boolean }>(`${AUTH_PREFIX}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
  return response;
}

export async function getSessionsApi(token: string): Promise<any[]> {
  const response = await apiRequest<any[]>(`${AUTH_PREFIX}/sessions`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response;
}

export async function terminateSessionApi(
  token: string,
  sessionId: string
): Promise<{ success: boolean }> {
  const response = await apiRequest<{ success: boolean }>(
    `${AUTH_PREFIX}/sessions/${sessionId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response;
}
