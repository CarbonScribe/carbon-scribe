# Authentication & Session Management

## Overview

The Corporate Platform frontend now implements secure, seamless user session management with automatic token refresh, ensuring users stay authenticated without frequent logins while maintaining security best practices.

## Architecture

### Components

1. **AuthContext** (`src/contexts/AuthContext.tsx`)
   - Central authentication state management
   - Login, register, logout functions
   - Automatic token refresh
   - Route protection

2. **Token Storage** (`src/lib/auth/token-storage.ts`)
   - Secure token storage in localStorage
   - Token expiry tracking
   - Session persistence

3. **API Client** (`src/lib/api/auth-http.ts`)
   - HTTP client with automatic token refresh
   - Request queuing during refresh
   - 401 error handling

4. **Auth API** (`src/lib/api/auth.api.ts`)
   - Authentication endpoint wrappers
   - Login, register, refresh, logout
   - User profile and session management

## Features

### 1. Automatic Token Refresh

- Access tokens expire every **15 minutes**
- Refresh tokens expire every **7 days**
- Tokens are automatically refreshed **60 seconds before expiry**
- Failed requests due to expired tokens are retried after refresh

### 2. Session Persistence

- User sessions persist across page reloads
- Sessions restore on browser restart (if refresh token is valid)
- Automatic token refresh on initialization if needed

### 3. Route Protection

- Public routes: `/login`, `/register`, `/forgot-password`, `/reset-password`
- All other routes require authentication
- Automatic redirect to login if not authenticated
- Automatic redirect to dashboard if already authenticated on public routes

### 4. Secure Logout

- Clears both access and refresh tokens
- Calls backend to invalidate session
- Clears all user data from localStorage
- Redirects to login page

### 5. Request Queuing

- When a token refresh is in progress, subsequent requests are queued
- Once refresh completes, queued requests proceed with new token
- Prevents race conditions and multiple refresh attempts

## Usage

### Login

```typescript
import { useAuth } from '@/contexts/AuthContext';

function LoginComponent() {
  const { login, isLoading } = useAuth();

  const handleLogin = async () => {
    try {
      await login({
        email: 'user@example.com',
        password: 'password123',
      });
      // Redirect handled automatically
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <button onClick={handleLogin} disabled={isLoading}>
      {isLoading ? 'Logging in...' : 'Login'}
    </button>
  );
}
```

### Register

```typescript
import { useAuth } from '@/contexts/AuthContext';

function RegisterComponent() {
  const { register, isLoading } = useAuth();

  const handleRegister = async () => {
    try {
      await register({
        email: 'newuser@example.com',
        password: 'securePassword123',
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Acme Corp',
      });
      // Redirect handled automatically
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };

  return <button onClick={handleRegister} disabled={isLoading}>Register</button>;
}
```

### Logout

```typescript
import { useAuth } from '@/contexts/AuthContext';

function LogoutButton() {
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      // Redirect to login handled automatically
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return <button onClick={handleLogout}>Logout</button>;
}
```

### Check Authentication Status

```typescript
import { useAuth } from '@/contexts/AuthContext';

function UserProfile() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      <h2>Welcome, {user.firstName} {user.lastName}!</h2>
      <p>Email: {user.email}</p>
      <p>Company ID: {user.companyId}</p>
    </div>
  );
}
```

### Using the Auth API Client

```typescript
import { authApiClient } from '@/lib/api/auth-http';

async function fetchData() {
  try {
    // Token is automatically attached and refreshed
    const data = await authApiClient.get('/api/v1/marketplace/credits');
    return data;
  } catch (error) {
    if (error.status === 401) {
      // User will be redirected to login automatically
      console.error('Authentication failed');
    }
    throw error;
  }
}
```

## Security Considerations

### Token Storage

- **Access Token**: Stored in localStorage (vulnerable to XSS, but short-lived)
- **Refresh Token**: Stored in localStorage (should migrate to HTTP-only cookies in production)
- **User Data**: Stored in localStorage for session restoration

### Best Practices

1. **HTTPS Only**: Always use HTTPS in production
2. **Short-Lived Access Tokens**: 15-minute expiry limits exposure
3. **Secure Refresh Tokens**: 7-day expiry with rotation on each use
4. **Token Blacklisting**: Backend invalidates tokens on logout
5. **Session Management**: Backend tracks sessions with IP and user agent

### Production Recommendations

For production deployment, consider:

1. **HTTP-Only Cookies**: Store refresh tokens in HTTP-only, Secure, SameSite cookies
2. **CSRF Protection**: Implement CSRF tokens for cookie-based auth
3. **Token Rotation**: Implement refresh token rotation (already supported by backend)
4. **Rate Limiting**: Backend implements rate limiting on auth endpoints
5. **Brute Force Protection**: Account lockout after failed attempts

## Backend Integration

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login user |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Logout and invalidate session |
| GET | `/api/v1/auth/me` | Get current user profile |
| POST | `/api/v1/auth/change-password` | Change password |
| POST | `/api/v1/auth/forgot-password` | Request password reset |
| POST | `/api/v1/auth/reset-password` | Reset password with token |
| GET | `/api/v1/auth/sessions` | List active sessions |
| DELETE | `/api/v1/auth/sessions/:id` | Terminate session |

### Token Flow

1. **Login/Registration**:
   - Backend returns `accessToken` (15min) and `refreshToken` (7d)
   - Frontend stores both tokens
   - Frontend tracks access token expiry time

2. **Token Refresh**:
   - Frontend detects token is about to expire (60s buffer)
   - Frontend calls `/api/v1/auth/refresh` with refresh token
   - Backend validates refresh token and session
   - Backend returns new access and refresh tokens
   - Frontend stores new tokens

3. **Logout**:
   - Frontend calls `/api/v1/auth/logout` with refresh token
   - Backend invalidates session and clears refresh token
   - Frontend clears all stored tokens and user data

## Testing

Run authentication tests:

```bash
npm test -- token-storage.test.ts
```

Test coverage includes:
- Token storage and retrieval
- Token expiry checking
- Authentication status
- Session management
- Data clearing

## Troubleshooting

### Common Issues

1. **Infinite Login Loop**:
   - Check if `NEXT_PUBLIC_API_BASE_URL` is correct
   - Verify backend is running and accessible
   - Check browser console for CORS errors

2. **Token Not Refreshing**:
   - Check if refresh token is stored: `localStorage.getItem('cs_refresh_token')`
   - Verify backend refresh endpoint is working
   - Check browser console for errors

3. **Session Not Persisting**:
   - Check if tokens are stored in localStorage
   - Verify tokens haven't expired
   - Check if refresh token is still valid on backend

4. **401 Errors on API Calls**:
   - Check if access token is present and valid
   - Verify token is being sent in Authorization header
   - Check if session is still valid on backend

### Debug Mode

Enable debug logging by adding to your `.env.local`:

```env
NEXT_PUBLIC_DEBUG=true
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API URL | `http://localhost:4000` |
| `NEXT_PUBLIC_TOKEN_REFRESH_BUFFER` | Seconds before expiry to refresh | `60` |
| `NEXT_PUBLIC_SESSION_TIMEOUT_WARNING` | Seconds before expiry to warn | `300` |

## Future Enhancements

- [ ] HTTP-only cookie support for refresh tokens
- [ ] Session timeout warning modal
- [ ] Multi-device session management UI
- [ ] Biometric authentication (WebAuthn)
- [ ] Two-factor authentication (2FA)
- [ ] Remember me functionality
- [ ] Social login (Google, GitHub, etc.)

## API Reference

### AuthContext Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `login` | `LoginCredentials` | `Promise<void>` | Authenticate user |
| `register` | `RegisterCredentials` | `Promise<void>` | Register new user |
| `logout` | None | `Promise<void>` | Logout user |
| `refreshToken` | None | `Promise<boolean>` | Manually refresh token |

### AuthContext State

| Property | Type | Description |
|----------|------|-------------|
| `user` | `AuthUser \| null` | Current user data |
| `isLoading` | `boolean` | Loading state |
| `isAuthenticated` | `boolean` | Authentication status |

## License

This implementation is part of the CarbonScribe Corporate Platform.
