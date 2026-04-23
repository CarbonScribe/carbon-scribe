# Authentication Quick Start

Get started with the authentication system in 5 minutes.

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   
   Create `.env.local` in the web directory:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Access the Application**
   - Go to `http://localhost:3000/login`
   - New users can click "Sign up" to register

## Quick Examples

### Login
```tsx
import { useAuth } from '@/hooks/use-auth';

export default function LoginPage() {
  const { login, error } = useAuth();
  
  const handleLogin = async (email, password) => {
    try {
      await login(email, password);
      // User is now authenticated
    } catch (err) {
      console.error(err.message);
    }
  };
}
```

### Check Authentication
```tsx
import { useAuth } from '@/hooks/use-auth';

export default function Profile() {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) return <div>Please log in</div>;
  
  return <div>Welcome, {user?.firstName}!</div>;
}
```

### Protect Routes
```tsx
import { ProtectedRoute } from '@/components/protected-route';

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <h1>Dashboard</h1>
    </ProtectedRoute>
  );
}
```

## Available Hooks

| Hook | Purpose |
|------|---------|
| `useAuth()` | Access auth state and actions |
| `useAuthInit()` | Initialize auth on app load |
| `useRequireAuth()` | Check if user is authenticated |

## Available Pages

| Page | Route | Purpose |
|------|-------|---------|
| Login | `/login` | User login |
| Register | `/register` | New account creation |
| Forgot Password | `/forgot-password` | Request password reset |
| Reset Password | `/reset-password?token=xyz` | Set new password |

## Common Tasks

### Handle Login Errors
```tsx
const { login, error } = useAuth();

try {
  await login(email, password);
} catch (err) {
  // Error is automatically stored in 'error' state
  console.log(error); // "Invalid credentials"
}
```

### Logout User
```tsx
const { logout } = useAuth();

const handleLogout = async () => {
  await logout();
  // User is logged out and tokens cleared
};
```

### Get Current User
```tsx
import { useAuthInit, useAuth } from '@/hooks/use-auth';

export default function App() {
  useAuthInit(); // Fetches user on mount
  
  const { user } = useAuth();
  
  return <div>{user?.email}</div>;
}
```

## Testing

Run tests:
```bash
npm run test
```

Run tests in watch mode:
```bash
npm run test:ui
```

Run tests once:
```bash
npm run test:run
```

## Backend Integration

Make sure the backend is running on the configured API URL. The frontend expects these endpoints:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- etc.

See [Full Documentation](./AUTH_IMPLEMENTATION.md) for complete details.

## Troubleshooting

### CORS Errors
- Ensure backend is running and accessible at `NEXT_PUBLIC_API_URL`
- Check backend CORS configuration

### "Invalid Token" Errors
- Check localStorage has tokens (DevTools → Application → Storage)
- Try logging out and logging in again
- Check backend JWT_SECRET matches

### Tests Won't Run
- Make sure dependencies are installed: `npm install`
- Clear node_modules: `rm -rf node_modules && npm install`

## Next Steps

- Read [Full Authentication Guide](./AUTH_IMPLEMENTATION.md)
- Check [Component Examples](./src/components/auth/)
- Review [Tests](./src/__tests__/)

## Support

For issues or questions:
1. Check [Full Documentation](./AUTH_IMPLEMENTATION.md)
2. Review test files for usage examples
3. Check browser console and network tab for errors
