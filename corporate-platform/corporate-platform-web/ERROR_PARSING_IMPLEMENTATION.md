# API Error Envelope Parsing Implementation

## Overview
This implementation standardizes API error envelope parsing across the CarbonScribe corporate platform web application. The system ensures consistent and actionable error messaging regardless of backend error response variations.

## Files Created/Modified

### New Files
1. **src/lib/utils/errorParser.ts** - Standardized error parser utility
2. **src/lib/utils/errorParser.test.ts** - Comprehensive test suite for the error parser
3. **src/components/common/ErrorDisplay.tsx** - Reusable error display component

### Modified Files
1. **src/lib/api/http.ts** - Integrated error parser into ApiError class and apiRequest function
2. **src/services/api-client.ts** - Integrated error parser into ApiResponse interface and fetch method
3. **src/hooks/useAuction.ts** - Updated to use parsedError from API responses
4. **src/hooks/useRetirement.ts** - Updated to use parsedError from API responses
5. **src/hooks/useCompliance.ts** - Updated to use parsedError from API responses

## Error Parser Features

### Supported Error Envelope Shapes
The error parser handles multiple backend error response formats:
- `{ message: string }`
- `{ error: string }`
- `{ error: { message: string } }`
- `{ errors: Array<{ message: string }> }`
- `{ errors: string[] }`
- `{ statusCode: number, message: string }`
- `{ detail: string }`
- `{ title: string, detail: string }`
- `{ title: string }`

### Field-Level Validation Errors
Support for field-level validation errors:
- `{ errors: { field: ['error message'] } }`
- `{ fieldErrors: { field: ['error message'] } }`

### Error Code Categorization
Error codes for conditional handling:
- `VALIDATION_ERROR` - Input validation failures
- `AUTH_ERROR` - Authentication/authorization issues
- `NOT_FOUND` - Resource not found
- `SERVER_ERROR` - Server-side errors (5xx)
- `NETWORK_ERROR` - Network connectivity issues
- `UNKNOWN_ERROR` - Unrecognized error types

### HTTP Status Code Mapping
User-friendly messages for common HTTP status codes:
- 400: Bad request
- 401: Authentication required
- 403: Access denied
- 404: Resource not found
- 409: Conflict
- 422: Validation error
- 429: Too many requests
- 500, 502, 503, 504: Server errors

## Usage

### In API Clients
The error parser is automatically integrated into both API clients:
- `src/lib/api/http.ts` - Base API client for lib/api services
- `src/services/api-client.ts` - API client for services layer

### In Custom Hooks
Hooks should use `parsedError?.message` for error messages:
```typescript
const response = await someService.getData();
if (!response.success) {
  setError(response.parsedError?.message ?? response.error ?? 'Fallback message');
}
```

### In Components
Use the ErrorDisplay component for consistent error UI:
```tsx
import ErrorDisplay from '@/components/common/ErrorDisplay';

<ErrorDisplay 
  error={error} 
  onRetry={handleRetry} 
  showFieldErrors={true} 
/>
```

### Direct Error Parsing
For custom error handling:
```typescript
import { parseApiError, ErrorCode, isErrorType } from '@/lib/utils/errorParser';

const parsed = parseApiError(errorBody, statusCode);
if (isErrorType(parsed, ErrorCode.VALIDATION_ERROR)) {
  // Handle validation errors
}
```

## Testing
Run the error parser tests:
```bash
npm test errorParser.test.ts
```

The test suite covers:
- All error envelope shapes
- Field-level validation errors
- Network and timeout errors
- Status code mapping
- Error code categorization
- Helper functions

## Migration Guide

### For Existing Components
1. Replace direct `error` string usage with `parsedError?.message`
2. Use ErrorDisplay component for consistent UI
3. Leverage error codes for conditional handling

### Example Migration
**Before:**
```tsx
{error && <div className="error">{error}</div>}
```

**After:**
```tsx
<ErrorDisplay error={error} onRetry={retry} />
```

## Benefits
- **Consistency**: All errors are parsed and displayed uniformly
- **Robustness**: Handles multiple backend error shapes gracefully
- **User-Friendly**: Actionable messages instead of raw JSON or generic errors
- **Maintainability**: Centralized error handling logic
- **Testability**: Comprehensive test coverage
- **Extensibility**: Easy to add new error envelope shapes

## Future Enhancements
- Add internationalization (i18n) support for error messages
- Integrate with error tracking/analytics services
- Add error severity levels
- Support for custom error message templates
