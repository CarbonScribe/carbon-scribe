# Quick Reference: Error Handling & Toast Notifications

## 🚀 Quick Start

### Import
```typescript
import { withMutationToast, showSuccessToast, showErrorToast } from '@/lib/utils/toast';
```

### Most Common Pattern
```typescript
const result = await withMutationToast(
  () => api.yourMutation(data),
  {
    loadingMessage: 'Processing...',
    successMessage: 'Success!',
    errorMessage: 'Failed',
    retryable: true,
  }
);
```

---

## 📋 Toast Functions

| Function | Use Case | Duration |
|----------|----------|----------|
| `showSuccessToast(msg)` | Confirm success | 3s |
| `showErrorToast(msg)` | Show errors | 8s |
| `showInfoToast(msg)` | Info messages | 5s |
| `showWarningToast(msg)` | Warnings | 5s |
| `showLoadingToast(msg)` | Async operations | Manual dismiss |

---

## 🎯 When to Use What

### ✅ Use `withMutationToast` for:
- API calls (create, update, delete)
- Form submissions
- Any async operation with success/error states

### ✅ Use `showSuccessToast` for:
- Simple confirmations
- Non-API success messages
- User feedback

### ✅ Use `showErrorToast` for:
- Validation errors
- Non-API failures
- Custom error handling

### ✅ Use `ActionableError` component for:
- Full-page errors
- Data fetch failures
- Critical errors requiring user action

---

## 💡 Options

### withMutationToast Options
```typescript
{
  loadingMessage?: string;    // Show loading toast
  successMessage: string;     // Required: success message
  errorMessage?: string;      // Custom error message
  onSuccess?: (data) => void; // Success callback
  onError?: (error) => void;  // Error callback
  retryable?: boolean;        // Show retry button (default: true)
  onRetry?: () => void;       // Retry action
}
```

### showErrorToast Options
```typescript
{
  description?: string;       // Additional context
  onRetry?: () => void;       // Retry action
  retryable?: boolean;        // Is this retryable?
  duration?: 'short' | 'medium' | 'long' | 'persistent';
}
```

---

## 🔴 Error Categories (Auto-Detected)

| Category | Retryable | Severity |
|----------|-----------|----------|
| Network errors | ✅ Yes | Error |
| Server errors (5xx) | ✅ Yes | Error |
| Auth errors (401) | ❌ No | Critical |
| Validation (400) | ❌ No | Warning |
| Permission (403) | ❌ No | Critical |
| Not found (404) | ❌ No | Error |
| Rate limit (429) | ✅ Yes | Info |

---

## 📝 Examples

### Create
```typescript
await withMutationToast(
  () => api.createProject(data),
  {
    loadingMessage: 'Creating project...',
    successMessage: 'Project created!',
    onSuccess: (project) => router.push(`/projects/${project.id}`),
  }
);
```

### Update
```typescript
await withMutationToast(
  () => api.updateProject(id, data),
  {
    successMessage: 'Project updated',
    retryable: true,
  }
);
```

### Delete
```typescript
await withMutationToast(
  () => api.deleteProject(id),
  {
    successMessage: 'Project deleted',
    retryable: false,
  }
);
```

### Form Validation
```typescript
if (!data.name) {
  showErrorToast('Name is required');
  return;
}
```

### Full-Page Error
```typescript
catch (error) {
  const actionableError = createActionableError(error, {
    retryAction: fetchData,
  });
  return <ActionableError error={actionableError} />;
}
```

---

## ⚠️ Common Mistakes

❌ **Don't show toasts for 403/404** - Handle in UI instead  
❌ **Don't use generic messages** - Be specific and helpful  
❌ **Don't forget loading states** - Always show progress  
❌ **Don't spam toasts** - System prevents duplicates automatically  

✅ **Do provide retry buttons** - For network/server errors  
✅ **Do use descriptive messages** - Help users understand  
✅ **Do handle both success & error** - Complete feedback loop  
✅ **Do use loading toasts** - For operations > 1 second  

---

## 🎨 Customization

### Change Duration
```typescript
showSuccessToast('Saved', { duration: 'long' }); // 8s
showErrorToast('Failed', { duration: 'persistent' }); // Manual dismiss
```

### Add Actions
```typescript
showErrorToast('Failed to sync', {
  action: {
    label: 'View Logs',
    onClick: () => openLogs(),
  },
});
```

### Custom Retry
```typescript
showErrorToast('Upload failed', {
  onRetry: () => uploadFile(file),
  retryable: true,
});
```

---

## ♿ Accessibility

All toasts are:
- ✅ Screen reader friendly
- ✅ Keyboard dismissible (Esc)
- ✅ Focus managed
- ✅ WCAG AA compliant

---

## 📚 Full Documentation

See `docs/ERROR_HANDLING_GUIDE.md` for:
- Complete API reference
- Migration guide
- Testing strategies
- Best practices
- More examples

---

**Need help?** Check the examples in `src/examples/toast-examples.ts`
