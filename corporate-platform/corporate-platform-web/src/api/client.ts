/**
 * HTTP Client with interceptor support for API requests
 * Handles error management, response parsing, and request logging
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
  timestamp?: string;
  message?: string;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
  timestamp?: string;
}

export class ApiErrorClass extends Error implements ApiError {
  status: number;
  code?: string;
  errors?: Record<string, string[]>;
  timestamp?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
    errors?: Record<string, string[]>,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.name = "ApiError";
  }
}

type RequestInterceptor = (config: RequestInit) => RequestInit;
type ResponseInterceptor = <T>(response: ApiResponse<T>) => ApiResponse<T>;
type ErrorInterceptor = (error: ApiErrorClass) => ApiErrorClass;

class ApiClient {
  private baseUrl: string;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
  }

  /**
   * Add a request interceptor to modify requests before sending
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add a response interceptor to process responses
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Add an error interceptor to handle errors
   */
  addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.errorInterceptors.push(interceptor);
  }

  /**
   * Execute request interceptors
   */
  private applyRequestInterceptors(config: RequestInit): RequestInit {
    return this.requestInterceptors.reduce(
      (config, interceptor) => interceptor(config),
      config,
    );
  }

  /**
   * Execute response interceptors
   */
  private applyResponseInterceptors<T>(
    response: ApiResponse<T>,
  ): ApiResponse<T> {
    return this.responseInterceptors.reduce(
      (response, interceptor) => interceptor(response),
      response,
    );
  }

  /**
   * Execute error interceptors
   */
  private applyErrorInterceptors(error: ApiErrorClass): ApiErrorClass {
    return this.errorInterceptors.reduce(
      (error, interceptor) => interceptor(error),
      error,
    );
  }

  /**
   * Make an HTTP request with automatic error handling
   */
  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    // Default config with credentials to include httpOnly cookies
    const defaultConfig: RequestInit = {
      credentials: "include", // Include cookies in requests
      headers: {
        "Content-Type": "application/json",
      },
    };

    // Merge options
    let config: RequestInit = { ...defaultConfig, ...options };
    config.headers = {
      ...(defaultConfig.headers as any),
      ...(options.headers as any),
    };

    // Apply request interceptors
    config = this.applyRequestInterceptors(config);

    try {
      const response = await fetch(url, config);
      const contentType = response.headers.get("content-type");

      let data: any = null;
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Handle non-2xx status codes
      if (!response.ok) {
        const error = new ApiErrorClass(
          data?.message || data?.error || `HTTP ${response.status}`,
          response.status,
          data?.code,
          data?.errors,
        );
        error.timestamp = data?.timestamp;

        const processedError = this.applyErrorInterceptors(error);
        throw processedError;
      }

      // Ensure response is ApiResponse format
      const apiResponse: ApiResponse<T> =
        data?.success !== undefined ? data : { success: true, data };

      // Apply response interceptors
      return this.applyResponseInterceptors(apiResponse);
    } catch (error) {
      if (error instanceof ApiErrorClass) {
        throw error;
      }

      // Handle network errors or other unexpected errors
      const networkError = new ApiErrorClass(
        error instanceof Error ? error.message : "Network error",
        0,
        "NETWORK_ERROR",
      );

      const processedError = this.applyErrorInterceptors(networkError);
      throw processedError;
    }
  }

  /**
   * GET request
   */
  get<T = any>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  /**
   * POST request
   */
  post<T = any>(
    endpoint: string,
    body?: any,
    options?: RequestInit,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request
   */
  put<T = any>(
    endpoint: string,
    body?: any,
    options?: RequestInit,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PATCH request
   */
  patch<T = any>(
    endpoint: string,
    body?: any,
    options?: RequestInit,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  delete<T = any>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

// Create singleton instance
const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api/v1";
export const apiClient = new ApiClient(apiBaseUrl);

export default apiClient;
