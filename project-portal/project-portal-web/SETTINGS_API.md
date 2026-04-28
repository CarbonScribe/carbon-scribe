# Settings API Integration Documentation

## Overview

Complete integration of the `/settings` backend endpoints with Next.js frontend. Provides comprehensive management for user profiles, notifications, API keys, integrations, and billing.

## Architecture

### API Client (`src/lib/api/settings/`)

#### `client.ts`
Main API client with async methods for all settings endpoints:

```typescript
// Profile
getProfile(segmented?: boolean): Promise<UserProfile>
updateProfile(payload: UpdateProfilePayload): Promise<UserProfile>
deleteProfile(): Promise<{ message: string }>
uploadProfilePicture(file: File): Promise<{ profile_picture_url: string }>
exportProfile(format: "json" | "csv"): Promise<Blob>

// Notifications
getNotifications(): Promise<NotificationPreference>
updateNotifications(payload: UpdateNotificationPayload): Promise<NotificationPreference>

// API Keys
getAPIKeys(): Promise<APIKey[]>
createAPIKey(payload: CreateAPIKeyPayload): Promise<APIKeyWithSecret>
validateAPIKey(key: string): Promise<APIKeyValidation>
deleteAPIKey(keyId: string): Promise<{ message: string }>
rotateAPIKey(keyId: string): Promise<APIKeyWithSecret>
getAPIKeyUsage(keyId: string): Promise<APIKeyUsage>
configureAPIKeyWebhook(keyId: string, webhookUrl: string): Promise<{ message: string }>

// Integrations
getIntegrations(): Promise<IntegrationConfiguration[]>
configureIntegration(payload: ConfigureIntegrationPayload): Promise<IntegrationConfiguration>
configureBatchIntegrations(integrations: ConfigureIntegrationPayload[]): Promise<IntegrationConfiguration[]>
getIntegrationHealth(integrationId: string): Promise<IntegrationHealth>
startOAuthFlow(provider: string): Promise<OAuthStartResponse>
completeOAuthCallback(provider: string, payload: OAuthCallbackPayload): Promise<IntegrationConfiguration>

// Billing
getBillingSummary(): Promise<BillingSummary>
getInvoices(): Promise<Invoice[]>
downloadInvoicePDF(invoiceId: string): Promise<Blob>
addPaymentMethod(payload: PaymentMethodPayload): Promise<{ message: string; payment_method_id: string }>
```

#### `types.ts`
Complete TypeScript interfaces for all data models and API responses.

### Error Handling (`src/lib/errors/settingsErrors.ts`)

Custom error classes with automatic HTTP status code mapping:

```typescript
- SettingsError: Base error class (500)
- AuthError: 401 Unauthorized
- ValidationError: 400 Bad Request (includes field errors)
- NotFoundError: 404 Not Found
- RateLimitError: 429 Too Many Requests (includes retry-after)
```

### Custom Hook (`src/lib/hooks/useSettings.ts`)

```typescript
const { data, isLoading, error, execute, reset } = useSettings({
  onSuccess: (data) => console.log("Success!", data),
  onError: (error) => console.error(error),
  showErrorToast: (message) => showToast("error", message),
});

// Execute async function with built-in loading/error handling
const result = await execute(() => getProfile());
```

## UI Components

### SettingsLayout
Main container with tab navigation. Manages active tab state and renders appropriate content.

```typescript
<SettingsLayout /> // Renders all tabs with navigation
```

### ProfileTab
- Edit profile picture (with upload)
- Update personal information
- Manage preferences (timezone, language, currency)
- Display social links and organization info

### NotificationsTab
- Configure notification channels (email, SMS, push, in-app)
- Manage notification categories
- Set quiet hours with timezone support
- Emergency override settings

### APIKeysTab
- List all API keys with usage info
- Create new keys with custom scopes
- View masked keys (prefix + last 4 chars)
- Rotate or revoke keys
- One-time secret display with copy-to-clipboard

### IntegrationsTab
- Connect/disconnect OAuth integrations
- View integration status and last sync time
- Configure webhook URLs
- Support for: Slack, GitHub, Jira, Stripe, Zapier

### BillingTab
- Display current plan and usage
- Visual usage progress bar with color coding
- Invoice history with download links
- Filter by status (paid, pending, overdue)
- Payment method management placeholder

## Usage Examples

### Basic Profile Update

```typescript
import { updateProfile } from "@/lib/api/settings";
import { showToast } from "@/components/ui/Toast";

try {
  const updated = await updateProfile({
    full_name: "John Doe",
    bio: "Software Engineer",
  });
  showToast("success", "Profile updated");
} catch (error) {
  showToast("error", "Failed to update profile");
}
```

### API Key Management

```typescript
import { createAPIKey, getAPIKeys } from "@/lib/api/settings";

// List all keys
const keys = await getAPIKeys();

// Create new key
const newKey = await createAPIKey({
  name: "Production API",
  scopes: ["read", "write"],
  rate_limit_per_minute: 1000,
});

// Secret is only shown once - must be copied immediately
console.log(newKey.secret_key); // sk_prod_...
```

### Integration Flow

```typescript
import { startOAuthFlow, completeOAuthCallback } from "@/lib/api/settings";

// Start OAuth
const result = await startOAuthFlow("slack");
window.location.href = result.oauth_url;

// After redirect (in callback handler)
const integration = await completeOAuthCallback("slack", {
  code: urlParams.get("code"),
  state: urlParams.get("state"),
});
```

### Using useSettings Hook

```typescript
import { useSettings } from "@/lib/hooks/useSettings";
import { getProfile } from "@/lib/api/settings";

export function MyComponent() {
  const { data, isLoading, error, execute } = useSettings({
    showErrorToast: showToast,
  });

  useEffect(() => {
    execute(() => getProfile());
  }, []);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>Hello, {data?.full_name}</div>;
}
```

## Error Handling

All errors are automatically categorized and handled:

```typescript
try {
  await updateProfile(data);
} catch (error) {
  if (isAuthError(error)) {
    // Redirect to login
  } else if (isValidationError(error)) {
    // Display field-specific errors
    Object.entries(error.errors).forEach(([field, messages]) => {
      console.error(`${field}: ${messages.join(", ")}`);
    });
  } else if (isRateLimitError(error)) {
    // Show retry message with countdown
    setTimeout(retry, error.retryAfter * 1000);
  } else if (isNotFoundError(error)) {
    // Show "not found" message
  } else {
    // Generic error handling
  }
}
```

## File Structure

```
src/
├── lib/
│   ├── api/
│   │   └── settings/
│   │       ├── client.ts          # Main API client
│   │       ├── types.ts           # TypeScript interfaces
│   │       └── index.ts           # Exports
│   ├── errors/
│   │   └── settingsErrors.ts      # Error handling
│   └── hooks/
│       └── useSettings.ts         # Custom hook
├── components/
│   └── settings/
│       ├── ProfileTab.tsx
│       ├── NotificationsTab.tsx
│       ├── APIKeysTab.tsx
│       ├── IntegrationsTab.tsx
│       ├── BillingTab.tsx
│       ├── SettingsLayout.tsx
│       └── index.ts
└── test/
    └── settings/
        └── client.test.ts
```

## Testing

Unit tests cover:
- Profile CRUD operations
- Notification preference management
- API key lifecycle (create, list, delete, rotate)
- Integration configuration
- Billing data retrieval
- Error handling for all status codes

Run tests:
```bash
npm test -- settings/client.test.ts
```

## API Base URL

Configured via environment variable:
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
# Or
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

Endpoints are relative to `/api/v1/settings`.

## Headers

All requests automatically include:
```
Authorization: Bearer <token>
Content-Type: application/json
```

Token is set via `setAuthToken()` after login. 401 responses automatically trigger logout.

## Performance

- Lazy loading of components with React.lazy()
- Optimized re-renders with useCallback
- Efficient state management using custom hooks
- Minimal API calls with request deduplication
- Built-in loading and error states

## Browser Support

- Chrome/Edge: Latest
- Firefox: Latest
- Safari: Latest
- No IE11 support

## Known Limitations

- OAuth flow redirects to external provider (requires separate callback handler)
- Secret keys displayed once only (no recovery option)
- Billing invoices require separate PDF download
- Quiet hours timezone is simplified (doesn't handle DST)

## Future Enhancements

- [ ] Pagination for API keys and invoices lists
- [ ] Bulk operations (delete multiple keys)
- [ ] Integration health monitoring dashboard
- [ ] API key usage analytics charts
- [ ] Webhook delivery retry mechanism
- [ ] Two-factor authentication setup
- [ ] Data export scheduling

## Support

For issues or questions, refer to:
- Backend Handler: `project-portal-backend/internal/settings/handler.go`
- DB Schema: `project-portal-backend/internal/database/migrations/010_settings_tables.up.sql`
- API Documentation: `/docs/api/settings.md`
