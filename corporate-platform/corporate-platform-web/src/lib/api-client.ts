import axios, { AxiosInstance, AxiosError } from 'axios';

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        // Handle 401 Unauthorized - attempt token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const refreshToken = this.getRefreshToken();
            if (!refreshToken) {
              this.clearTokens();
              window.location.href = '/login';
              return Promise.reject(error);
            }

            const response = await axios.post(`${this.baseURL}/api/v1/auth/refresh`, {
              refreshToken,
            });

            const { accessToken, refreshToken: newRefreshToken } = response.data;
            this.setTokens(accessToken, newRefreshToken);

            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            this.clearTokens();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(this.formatError(error));
      }
    );
  }

  private formatError(error: AxiosError): ApiError {
    if (error.response?.data) {
      const data = error.response.data as any;
      return {
        message: data.message || 'An error occurred',
        statusCode: error.response.status || 500,
        error: data.error,
      };
    }
    return {
      message: error.message || 'Network error',
      statusCode: error.code === 'ECONNABORTED' ? 408 : 500,
    };
  }

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refreshToken');
  }

  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  // Auth API methods
  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName: string;
  }) {
    const response = await this.client.post('/api/v1/auth/register', data);
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/api/v1/auth/login', {
      email,
      password,
    });
    return response.data;
  }

  async logout(refreshToken: string) {
    await this.client.post('/api/v1/auth/logout', { refreshToken });
    this.clearTokens();
  }

  async getCurrentUser() {
    const response = await this.client.get('/api/v1/auth/me');
    return response.data;
  }

  async refreshToken(refreshToken: string) {
    const response = await this.client.post('/api/v1/auth/refresh', {
      refreshToken,
    });
    return response.data;
  }

  async changePassword(oldPassword: string, newPassword: string) {
    const response = await this.client.post('/api/v1/auth/change-password', {
      oldPassword,
      newPassword,
    });
    return response.data;
  }

  async forgotPassword(email: string) {
    const response = await this.client.post('/api/v1/auth/forgot-password', {
      email,
    });
    return response.data;
  }

  async resetPassword(token: string, newPassword: string) {
    const response = await this.client.post('/api/v1/auth/reset-password', {
      token,
      newPassword,
    });
    return response.data;
  }

  async getSessions() {
    const response = await this.client.get('/api/v1/auth/sessions');
    return response.data;
  }

  async terminateSession(sessionId: string) {
    const response = await this.client.delete(`/api/v1/auth/sessions/${sessionId}`);
    return response.data;
  }

  // Generic request methods
  get<T = any>(url: string, config?: any) {
    return this.client.get<T>(url, config);
  }

  post<T = any>(url: string, data?: any, config?: any) {
    return this.client.post<T>(url, data, config);
  }

  put<T = any>(url: string, data?: any, config?: any) {
    return this.client.put<T>(url, data, config);
  }

  delete<T = any>(url: string, config?: any) {
    return this.client.delete<T>(url, config);
  }
}

export const apiClient = new ApiClient();
