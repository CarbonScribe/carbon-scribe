# Authentication Implementation Guide

## Overview

The corporate platform implements a complete authentication system with secure token management, user registration, login, and password reset flows. The frontend integrates with the backend Auth API endpoints to provide a seamless user experience.

## Architecture

### Components

1. **API Client** (`src/lib/api-client.ts`)
   - Handles all HTTP requests to the backend
   - Manages token storage and retrieval
   - Implements request/response interceptors for token refresh
   - Provides centralized error handling

2. **Auth Store** (`src/lib/auth-store.ts`)
   - Zustand-based state management for authentication
   - Manages user state, loading states, and errors
   - Provides actions: login, register, logout, getCurrentUser

3. **Auth Hooks** (`src/hooks/use-auth.ts`)
   - `useAuth()` - Main hook for accessing auth state and actions
   - `useAuthInit()` - Initializes auth state on app load
   - `useRequireAuth()` - Checks authentication for protected routes

4. **Protected Routes** (`src/components/protected-route.tsx`)
   - Wrapper component for pages requiring authentication
   - Redirects unauthenticated users to login

5. **Forms and Pages**
   - Login Form: `src/components/auth/login-form.tsx`
   - Register Form: `src/components/auth/register-form.tsx`
   - Forgot Password Form: `src/components/auth/forgot-password-form.tsx`
   - Reset Password Form: `src/components/auth/reset-password-form.tsx`

## Authentication Flow

### Login Flow

1. User navigates to `/login`
2. Enters email and password
3. LoginForm validates input using Zod schema
4. On submit, calls `useAuth().login(email, password)`
5. API client sends POST request to `/api/v1/auth/login`
6. Backend validates credentials and returns `{ accessToken, refreshToken, user }`
7. Tokens are stored in localStorage
8. User is redirected to `/dashboard`

### Registration Flow

1. User navigates to `/register`
2. Fills in: email, first/last name, company, password
3. RegisterForm validates input using Zod schema
4. On submit, calls `useAuth().register(data)`
5. API client sends POST request to `/api/v1/auth/register`
6. Backend creates user account and returns tokens
7. Tokens are stored in localStorage
8. User is redirected to `/dashboard`

### Token Refresh Flow

1. When a request returns 401 Unauthorized
2. Response interceptor automatically sends refresh token to `/api/v1/auth/refresh`
3. Backend validates refresh token and returns new access token
4. Original request is retried with new token
5. If refresh fails, user is redirected to login

### Password Reset Flow

1. User navigates to `/forgot-password`
2. Enters email address
3. Backend sends reset email with token
4. User clicks link in email (e.g., `/reset-password?token=xyz`)
5. User enters new password
6. Form sends POST to `/api/v1/auth/reset-password` with token and new password
7. User is redirected to login

## Configuration

### Environment Variables

Create `.env.local` file in the web directory:

```env
# API endpoint
NEXT_PUBLIC_API_URL=http://localhost:3001
```

For production:
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

## Security Considerations

### Token Storage

- **Current Implementation**: localStorage (suitable for SPAs)
- **Note**: localStorage is accessible to JavaScript, so XSS attacks could expose tokens
- **Mitigation**: Use HTTP-only cookies for more security (requires backend CORS setup)

### Password Requirements

Backend enforces:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&*()_+=-[]{};':"\\|,.<>/?)

### API Interceptors

- All requests include Authorization Bearer token automatically
- Token refresh happens transparently on 401 responses
- Failed token refresh redirects to login page

## Usage Examples

### Using Authentication in Components

```tsx
'use client';

import { useAuth } from '@/hooks/use-auth';

export default function MyComponent() {
  const { user, isLoading, error, logout } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Welcome, {user?.firstName}!</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Protecting Routes

```tsx
import { ProtectedRoute } from '@/components/protected-route';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div>Dashboard content - only visible to authenticated users</div>
    </ProtectedRoute>
  );
}
```

### Making Authenticated API Calls

```tsx
import { apiClient } from '@/lib/api-client';

// Use the client for additional API calls
const response = await apiClient.get('/api/v1/users/profile');
```

## Backend Integration

The frontend integrates with these backend endpoints:

- `POST /api/v1/auth/register` - Create new account
- `POST /api/v1/auth/login` - Login with email/password
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout and invalidate session
- `GET /api/v1/auth/me` - Get current user info
- `POST /api/v1/auth/change-password` - Change password (requires auth)
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Complete password reset
- `GET /api/v1/auth/sessions` - List user sessions (requires auth)
- `DELETE /api/v1/auth/sessions/:id` - Terminate session (requires auth)

## Testing

### Run Tests

```bash
npm run test
```

### Test Coverage

Tests are located in `src/__tests__/`:
- `validation-schemas.test.ts` - Zod schema validation
- `api-client.test.ts` - API client functionality

### Key Test Areas

1. **Validation**
   - Login credentials validation
   - Registration data validation
   - Password strength requirements
   - Form field validation

2. **API Client**
   - Token management
   - Request interceptors
   - Error handling
   - Token refresh logic

3. **Auth Store**
   - Login/register actions
   - Logout functionality
   - Error states
   - User state management

4. **Components**
   - Form submission
   - Error display
   - Loading states
   - Redirect behavior

## Error Handling

Common error scenarios:

1. **Invalid Credentials**
   - Error message: "Invalid email or password"
   - Action: User re-enters credentials

2. **Duplicate Email**
   - Error message: "Email already registered"
   - Action: User logs in or uses forgot password

3. **Weak Password**
   - Error message: Shows missing requirements
   - Action: User enters stronger password

4. **Network Error**
   - Error message: "Network error" or timeout message
   - Action: User retries operation

5. **Token Expiration**
   - Automatic refresh attempted
   - If failed: Redirect to login with message

## Troubleshooting

### CORS Errors

If you see CORS errors:
1. Ensure backend is running and accessible
2. Check `NEXT_PUBLIC_API_URL` environment variable
3. Verify backend CORS settings allow localhost:3000

### Tokens Not Persisting

If tokens disappear after page reload:
1. Check localStorage in browser DevTools
2. Ensure `setTokens()` was called after login
3. Check for localStorage clearing on logout

### 401 Errors After Login

If you get 401 even after login:
1. Verify token is stored in localStorage
2. Check API endpoint is correct
3. Ensure backend is using correct JWT secret

## Future Enhancements

- [ ] OAuth2/Social login integration
- [ ] Two-factor authentication (2FA)
- [ ] Email verification on registration
- [ ] Session management UI
- [ ] Remember me functionality
- [ ] Biometric authentication support

## Related Documentation

- [Backend Auth Service](../corporate-platform-backend/README.md#authentication)
- [API Client Implementation](./src/lib/api-client.ts)
- [Auth Store Implementation](./src/lib/auth-store.ts)
