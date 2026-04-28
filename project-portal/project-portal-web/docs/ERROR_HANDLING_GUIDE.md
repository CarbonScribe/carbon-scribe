# Error Handling & Toast Notification Guide

## Overview

This guide covers the enhanced error handling and toast notification system implemented in the Project Portal web application. The system provides actionable feedback, retry options, and consistent UX across all user interactions.

## Architecture

### Core Components

1. **Error Utilities** (`src/lib/utils/errorHandler.ts`)
   - Error categorization and severity classification
   - Actionable error object creation
   - Standardized error messages and troubleshooting tips

2. **Toast Utilities** (`src/lib/utils/toast.ts`)
   - Wrapper around Sonner toast library
   - Pre-configured toast types (success, error, info, warning, loading)
   - Mutation wrapper with automatic error handling

3. **ActionableError Component** (`src/components/ui/ActionableError.tsx`)
   - Full-page or inline error display
   - Retry buttons and support links
   - Troubleshooting tips

4. **API Interceptor** (`src/lib/api/axios.ts`)
   - Global error handling for API calls
   - Duplicate error prevention
   - Context-aware error messages

## Usage Patterns

### 1. Simple Success/Error Toasts

```typescript
import { showSuccessToast, showErrorToast } from '@/lib/utils/toast';

// Success
showSuccessToast('Project created successfully');

// Success with description
showSuccessToast('Project created', {
  description: 'You can now add monitoring data',
});

// Error with retry
showErrorToast('Failed to save project', {
  description: 'Please check your connection and try again',
  onRetry: () => saveProject(projectData),
  retryable: true,
});
```

### 2. Mutation Wrapper (Recommended for API calls)

```typescript
import { withMutationToast } from '@/lib/utils/toast';

// Basic usage
const result = await withMutationToast(
  () => api.createProject(projectData),
  {
    successMessage: 'Project created successfully',
    errorMessage: 'Failed to create project',
  }
);

// With loading state and callbacks
const result = await withMutationToast(
  () => api.updateProject(id, projectData),
  {
    loadingMessage: 'Saving project...',
    successMessage: 'Project updated successfully',
    onSuccess: (data) => {
      refreshProjectList();
    },
    onError: (error) => {
      logError(error);
    },
    retryable: true,
    onRetry: () => updateProject(id, projectData),
  }
);
```

### 3. Delete Confirmation with Toast

```typescript
import { withMutationToast } from '@/lib/utils/toast';

const handleDelete = async (id: string) => {
  const confirmed = window.confirm('Are you sure you want to delete this project?');
  if (!confirmed) return;

  const result = await withMutationToast(
    () => api.deleteProject(id),
    {
      successMessage: 'Project deleted successfully',
      errorMessage: 'Failed to delete project',
      onSuccess: () => {
        refreshProjectList();
      },
      retryable: false, // Don't retry deletes
    }
  );

  if (result) {
    // Handle successful deletion
  }
};
```

### 4. Full-Page Error with ActionableError Component

```typescript
'use client';

import { useState } from 'react';
import { createActionableError } from '@/lib/utils/errorHandler';
import ActionableError from '@/components/ui/ActionableError';

export default function ProjectPage() {
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const data = await api.getProject(id);
      setError(null);
      // Use data...
    } catch (err) {
      setError(createActionableError(err, {
        retryAction: fetchProject,
      }));
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return <ActionableError error={error} />;
  }

  // Render project...
}
```

### 5. Form Submission with Validation Errors

```typescript
import { withMutationToast } from '@/lib/utils/toast';

const handleSubmit = async (data: FormData) => {
  // Client-side validation
  if (!data.name) {
    showErrorToast('Project name is required', {
      duration: 'medium',
    });
    return;
  }

  // API call with toast
  const result = await withMutationToast(
    () => api.createProject(data),
    {
      loadingMessage: 'Creating project...',
      successMessage: 'Project created successfully!',
      errorMessage: 'Failed to create project. Please try again.',
      onSuccess: (newProject) => {
        router.push(`/projects/${newProject.id}`);
      },
      retryable: true,
    }
  );
};
```

## Error Categories & Severity

### Categories
- `network` - Connection/timeout issues
- `authentication` - Session expired, unauthorized
- `validation` - Invalid input, missing fields
- `permission` - Access denied
- `not_found` - Resource doesn't exist
- `server` - Internal server errors
- `rate_limit` - Too many requests
- `conflict` - Duplicate entry, version conflict
- `business_logic` - Domain-specific errors
- `unknown` - Fallback

### Severity Levels
- `critical` - Authentication/permission issues (requires immediate action)
- `error` - Network/server errors (needs attention)
- `warning` - Validation/conflict issues (user can fix)
- `info` - Rate limits, informational messages

## Toast Types & Usage

| Type | When to Use | Duration | Auto-dismiss |
|------|-------------|----------|--------------|
| Success | Confirm successful actions | 3s | Yes |
| Error | Action failures, API errors | 8s | Yes |
| Info | Informational messages | 5s | Yes |
| Warning | Non-critical issues | 5s | Yes |
| Loading | Async operations | Persistent | Manual |

## Best Practices

### DO:
✅ Always provide success feedback for mutations  
✅ Include retry buttons for network/server errors  
✅ Use `withMutationToast` for consistent error handling  
✅ Add descriptive error messages, not just "Error occurred"  
✅ Use appropriate toast durations based on message importance  
✅ Provide troubleshooting tips for complex errors  

### DON'T:
❌ Show duplicate error toasts (handled automatically)  
❌ Use generic messages without context  
❌ Show toasts for expected 403/404 errors (handle in UI)  
❌ Forget to handle loading states for async operations  
❌ Use error toasts for validation (use inline form errors)  

## Migration Guide

### Old Pattern (Before)
```typescript
try {
  await api.createProject(data);
  showToast('success', 'Created');
} catch (err) {
  showToast('error', 'Failed');
}
```

### New Pattern (After)
```typescript
await withMutationToast(
  () => api.createProject(data),
  {
    loadingMessage: 'Creating project...',
    successMessage: 'Project created successfully',
    errorMessage: 'Failed to create project',
    retryable: true,
    onRetry: () => createProject(data),
  }
);
```

## Accessibility

All toast notifications are:
- ✅ Screen reader friendly (ARIA live regions)
- ✅ Keyboard dismissible (Escape key)
- ✅ Focus managed properly
- ✅ Color contrast compliant (WCAG AA)
- ✅ Non-blocking (users can continue working)

## Testing Error States

### Simulate Different Errors

```typescript
// Network error
await withMutationToast(
  () => Promise.reject(new Error('Network error')),
  { successMessage: 'Success', errorMessage: 'Network failed' }
);

// Server error (500)
await withMutationToast(
  () => Promise.reject({ response: { status: 500 } }),
  { successMessage: 'Success', errorMessage: 'Server error' }
);

// Validation error (400)
await withMutationToast(
  () => Promise.reject({ response: { status: 400, data: { message: 'Invalid input' } } }),
  { successMessage: 'Success', errorMessage: 'Validation failed' }
);
```

## Files Reference

| File | Purpose |
|------|---------|
| `src/lib/utils/errorHandler.ts` | Error utilities and categorization |
| `src/lib/utils/toast.ts` | Toast notification wrappers |
| `src/components/ui/ActionableError.tsx` | Full-page error component |
| `src/lib/api/axios.ts` | API error interceptor |
| `package.json` | Sonner dependency (toast library) |

## Support & Troubleshooting Links

Configure support links in `errorHandler.ts` ERROR_MESSAGES object:

```typescript
export const ERROR_MESSAGES = {
  network: {
    // ...
    supportLink: '/support/network-issues',
  },
  // ...
};
```

## Future Enhancements

- [ ] Add error analytics tracking
- [ ] Implement error recovery suggestions based on error patterns
- [ ] Add offline detection and queue for retries
- [ ] Implement error boundary components for React error boundaries
- [ ] Add error dashboard for admin users
- [ ] Localize error messages

## Questions?

For questions or to report issues with error handling, contact the development team or open an issue in the repository.
