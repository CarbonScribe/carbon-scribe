# Invitation Lifecycle Implementation Guide

## Overview
This document describes the complete implementation of the invitation lifecycle feature for the Carbon Scribe project portal, including resend, cancel, accept, and decline operations.

## Architecture

### Backend (Go/Gin)
- **Location**: `internal/collaboration/`
- **Components**:
  - `models.go`: Invitation status constants and data models
  - `service.go`: Business logic for lifecycle operations
  - `handler.go`: HTTP endpoint handlers
  - `repository.go`: Database operations
  - `routes.go`: Route registration
  - `invitation_lifecycle_test.go`: Comprehensive test suite

### Frontend (Next.js/Zustand)
- **Location**: `src/lib/store/collaboration/` and `src/components/collaboration/`
- **Components**:
  - `collaboration.api.ts`: API client functions
  - `collaboration.types.ts`: TypeScript interfaces
  - `collaborationSlice.ts`: Zustand store actions
  - `InvitationActions.tsx`: UI component for action buttons
  - `PendingInvitationsList.tsx`: Updated list component with actions

## Database Schema

### Invitation Status Enum
```
- pending: Initial state when invitation is created
- accepted: User accepted the invitation
- declined: User declined the invitation
- cancelled: Manager cancelled the invitation
- expired: Invitation expired (48 hours)
```

### Invitation Table Columns
```sql
- id (UUID, primary key)
- project_id (UUID, indexed)
- email (string, indexed)
- role (string)
- token (string, unique)
- status (string, indexed, default: 'pending')
- expires_at (timestamp)
- resent_at (timestamp, nullable)
- resent_count (integer, default: 0)
- created_at (timestamp)
- updated_at (timestamp)
- deleted_at (timestamp, soft delete)
```

## API Endpoints

### Resend Invitation
```
POST /api/v1/collaboration/invitations/:id/resend
Response: ProjectInvitation (updated)
Errors:
  - 400: Only pending invitations can be resent
  - 400: Maximum resend limit reached (3)
  - 400: Invitation has expired
  - 404: Invitation not found
```

### Cancel Invitation
```
POST /api/v1/collaboration/invitations/:id/cancel
Response: { ok: true }
Errors:
  - 400: Only pending invitations can be cancelled
  - 404: Invitation not found
```

### Accept Invitation
```
POST /api/v1/collaboration/invitations/:id/accept
Response: ProjectMember (newly created)
Errors:
  - 400: Only pending invitations can be accepted
  - 400: Invitation has expired
  - 404: Invitation not found
```

### Decline Invitation
```
POST /api/v1/collaboration/invitations/:id/decline
Response: { ok: true }
Errors:
  - 400: Only pending invitations can be declined
  - 400: Invitation has expired
  - 404: Invitation not found
```

## State Machine

```
┌─────────┐     create     ┌─────────┐
│  DRAFT  │───────────────>│ PENDING │
└─────────┘                └─────────┘
                                 │
                    resend       │
                  (same state)   │
                                 │
                    cancel/expire│
                                 │
                                 ↓
                            ┌─────────┐
                            │ CANCELLED│
                            │ EXPIRED  │
                            └─────────┘
                                 │
                    accept/decline│
                    from PENDING  │
                                 ↓
                        ┌──────────────┐
                        │ ACCEPTED     │
                        │ DECLINED     │
                        └──────────────┘
```

## Validation Rules

### Resend Invitation
- ✓ Only pending invitations can be resent
- ✓ Maximum 3 resends per invitation
- ✓ Cannot resend expired invitations
- ✓ Updates `resent_at` and increments `resent_count`

### Cancel Invitation
- ✓ Only pending invitations can be cancelled
- ✓ Only project managers can cancel
- ✓ Sets status to `cancelled`

### Accept Invitation
- ✓ Only pending invitations can be accepted
- ✓ Cannot accept expired invitations
- ✓ Creates ProjectMember record
- ✓ Sets status to `accepted`

### Decline Invitation
- ✓ Only pending invitations can be declined
- ✓ Cannot decline expired invitations
- ✓ Sets status to `declined`

## Activity Logging

All lifecycle operations create activity log entries:
- `user_invited`: When invitation is created
- `invitation_resent`: When invitation is resent
- `invitation_cancelled`: When invitation is cancelled
- `invitation_accepted`: When invitation is accepted
- `invitation_declined`: When invitation is declined

## Frontend Store Integration

### Loading States
```typescript
collaborationLoading: {
  resendInvitation: boolean;
  cancelInvitation: boolean;
  acceptInvitation: boolean;
  declineInvitation: boolean;
}
```

### Error States
```typescript
collaborationErrors: {
  resendInvitation: string | null;
  cancelInvitation: string | null;
  acceptInvitation: string | null;
  declineInvitation: string | null;
}
```

### Store Actions
```typescript
resendInvitation(invitationId: string): Promise<boolean>
cancelInvitation(invitationId: string): Promise<boolean>
acceptInvitation(invitationId: string): Promise<boolean>
declineInvitation(invitationId: string): Promise<boolean>
```

## UI Components

### InvitationActions Component
Displays action buttons based on user role and invitation status:
- **Manager Actions**: Resend, Cancel
- **Invited User Actions**: Accept, Decline
- **Status Display**: Shows final status (Accepted, Declined, Cancelled, Expired)

Features:
- Confirmation dialogs for destructive actions
- Loading states during API calls
- Toast notifications for success/error
- Disabled state when max resends reached
- Resend count display

### PendingInvitationsList Component
Updated to show:
- Invitation email and role
- Expiration date
- Resend count
- Action buttons via InvitationActions component

## Testing

### Unit Tests
Located in `invitation_lifecycle_test.go`:
- `TestResendInvitation`: Verify resend increments count
- `TestCancelInvitation`: Verify status change to cancelled
- `TestAcceptInvitation`: Verify member creation and status change
- `TestDeclineInvitation`: Verify status change to declined
- `TestInvitationExpiry`: Verify expired invitations cannot be accepted
- `TestMaxResendLimit`: Verify max resend limit enforcement
- `TestInvitationStateTransitions`: Verify invalid state transitions

### Integration Tests
Run with:
```bash
cd project-portal/project-portal-backend
go test ./internal/collaboration/... -v
```

### Frontend Testing
Manual testing checklist:
- [ ] Resend button appears for pending invitations
- [ ] Resend button disabled after 3 resends
- [ ] Cancel button appears for managers
- [ ] Accept/Decline buttons appear for invited users
- [ ] Confirmation dialogs appear before actions
- [ ] Toast notifications show success/error
- [ ] Invitation status updates without page refresh
- [ ] Expired invitations show correct status

## Implementation Checklist

### Backend
- [x] Add lifecycle service methods (resend, cancel, accept, decline)
- [x] Add lifecycle handler methods
- [x] Add lifecycle API endpoints
- [x] Add status validation logic
- [x] Add activity logging
- [x] Register routes in main.go
- [x] Add comprehensive tests
- [x] Verify error handling

### Frontend
- [x] Add lifecycle API client functions
- [x] Add loading/error states to types
- [x] Add lifecycle actions to store
- [x] Create InvitationActions component
- [x] Update PendingInvitationsList component
- [x] Add confirmation dialogs
- [x] Add toast notifications
- [x] Test all workflows

## Deployment Notes

1. **Database Migration**: The invitation table already has all required columns (status, expires_at, resent_at, resent_count)
2. **Environment Variables**: No new environment variables required
3. **Backward Compatibility**: Existing invitations will have status='pending' by default
4. **API Versioning**: All endpoints use /api/v1/collaboration prefix

## Future Enhancements

1. **Email Notifications**: Send emails on resend, accept, decline
2. **Invitation Expiry Job**: Background job to mark expired invitations
3. **Bulk Operations**: Resend/cancel multiple invitations at once
4. **Invitation History**: Track all state transitions
5. **Custom Expiry**: Allow configurable invitation expiry duration
6. **Invitation Templates**: Customize invitation messages

## Troubleshooting

### Invitations not appearing in list
- Check that `fetchInvitations` is called after component mount
- Verify project ID is correct
- Check browser console for API errors

### Actions not working
- Verify auth token is set in store
- Check that user has appropriate permissions
- Look for error messages in toast notifications
- Check browser network tab for API responses

### Confirmation dialogs not closing
- Ensure `setShowConfirm(null)` is called after action
- Check for JavaScript errors in console

## References

- Backend Routes: `internal/collaboration/routes.go`
- Service Logic: `internal/collaboration/service.go`
- Frontend Store: `src/lib/store/collaboration/collaborationSlice.ts`
- UI Components: `src/components/collaboration/`
