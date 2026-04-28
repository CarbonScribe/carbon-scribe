import { AxiosError } from "axios";
import {
  SettingsError,
  AuthError,
  ValidationError,
  NotFoundError,
  RateLimitError,
} from "@/lib/api/settings/types";

export function handleSettingsError(error: unknown): never {
  if (error instanceof AxiosError) {
    const status = error.response?.status || 0;
    const data = error.response?.data as any;

    switch (status) {
      case 400:
        throw new ValidationError(
          data?.errors || {},
          data?.message || "Validation failed"
        );
      case 401:
        throw new AuthError(data?.message || "Unauthorized");
      case 404:
        throw new NotFoundError(data?.message || "Resource not found");
      case 429:
        const retryAfter = parseInt(
          error.response?.headers?.["retry-after"] || "60",
          10
        );
        throw new RateLimitError(retryAfter);
      default:
        throw new SettingsError(
          status,
          data?.message || error.message || "An error occurred"
        );
    }
  }

  throw new SettingsError(500, "An unexpected error occurred");
}

export function isSettingsError(error: any): error is SettingsError {
  return error instanceof SettingsError;
}

export function isAuthError(error: any): error is AuthError {
  return error instanceof AuthError;
}

export function isValidationError(error: any): error is ValidationError {
  return error instanceof ValidationError;
}

export function isNotFoundError(error: any): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isRateLimitError(error: any): error is RateLimitError {
  return error instanceof RateLimitError;
}
