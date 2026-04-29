/**
 * Authentication utilities for JWT token management
 * Handles reading tokens from httpOnly cookies and JWT payload extraction
 */

export interface JwtPayload {
  sub: string; // userId
  email: string;
  companyId: string;
  role: string;
  sessionId: string;
  iat?: number; // issued at
  exp?: number; // expiration
}

/**
 * Decode JWT token (client-side, without verification)
 * WARNING: This is for client-side use only. Never trust the decoded data without server-side verification.
 */
export function decodeJWT(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    const payload = JSON.parse(atob(parts[1]));
    return payload as JwtPayload;
  } catch {
    console.error("Failed to decode JWT token");
    return null;
  }
}

/**
 * Check if JWT token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return true;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  return payload.exp < currentTime;
}

/**
 * Get current JWT payload from httpOnly cookie
 * The actual token is in an httpOnly cookie, but we can extract it via:
 * 1. The browser automatically includes it in requests (credentials: 'include')
 * 2. We can try to read from a public payload cookie if backend provides one
 * 3. Or we can decode if exposed in a separate non-secure cookie
 */
export function getCurrentJWTPayload(): JwtPayload | null {
  // Try to read from a public auth cookie that might contain the payload
  // This assumes the backend sets a separate cookie with the JWT payload
  const cookieName = "jwt_payload"; // Convention, adjust if needed
  const cookies = document.cookie.split(";");

  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === cookieName && value) {
      try {
        return JSON.parse(decodeURIComponent(value)) as JwtPayload;
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Check if user is authenticated
 * Relies on httpOnly cookie being present (we can't directly read it)
 * Use the payload cookie or check with backend
 */
export function isAuthenticated(): boolean {
  const payload = getCurrentJWTPayload();

  if (!payload) {
    return false;
  }

  return !isTokenExpired(""); // We can't directly verify without the token
}

/**
 * Get user info from current session
 */
export function getCurrentUser(): Omit<JwtPayload, "iat" | "exp"> | null {
  const payload = getCurrentJWTPayload();

  if (!payload) {
    return null;
  }

  const { iat, exp, ...userInfo } = payload;
  return userInfo;
}

/**
 * Get company ID from current session
 */
export function getCurrentCompanyId(): string | null {
  const payload = getCurrentJWTPayload();
  return payload?.companyId || null;
}

/**
 * Check if user has specific role
 */
export function hasRole(role: string): boolean {
  const payload = getCurrentJWTPayload();
  return payload?.role === role;
}

/**
 * Logout user by clearing authentication
 * Frontend clears local state, backend should handle cookie clearing
 */
export async function logout(): Promise<void> {
  try {
    // Call backend logout endpoint to clear httpOnly cookies
    const response = await fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn("Logout API call failed");
    }
  } catch (error) {
    console.error("Logout error:", error);
  }
}

/**
 * Refresh authentication token
 * Backend should handle token refresh via httpOnly cookies
 */
export async function refreshToken(): Promise<boolean> {
  try {
    const response = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.ok;
  } catch (error) {
    console.error("Token refresh error:", error);
    return false;
  }
}

/**
 * Verify authentication with backend
 * Useful for checking if session is still valid
 */
export async function verifyAuthentication(): Promise<boolean> {
  try {
    const response = await fetch("/api/v1/auth/verify", {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.ok;
  } catch (error) {
    console.error("Authentication verification error:", error);
    return false;
  }
}

/**
 * Setup auth interceptor for API client
 * This should be called once on app initialization
 */
export function setupAuthInterceptors(apiClient: any): void {
  // Add request interceptor to attach Bearer token if needed
  // Note: With httpOnly cookies, the browser automatically includes them
  // This can be used for additional auth headers or custom tokens
  apiClient.addRequestInterceptor((config: RequestInit) => {
    // httpOnly cookies are automatically included with credentials: 'include'
    return config;
  });

  // Add error interceptor to handle 401/403 errors
  apiClient.addErrorInterceptor((error: any) => {
    if (error.status === 401) {
      // Attempt to refresh token
      refreshToken().catch(() => {
        // If refresh fails, redirect to login
        window.location.href = "/login";
      });
    } else if (error.status === 403) {
      // Permission denied, might redirect to access denied page
      console.error("Access denied:", error.message);
    }
    return error;
  });
}
