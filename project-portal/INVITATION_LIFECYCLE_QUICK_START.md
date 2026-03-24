# Invitation Lifecycle - Quick Start Guide

## What Was Implemented

Complete invitation lifecycle management with resend, cancel, accept, and decline operations for the Carbon Scribe project portal.

## Files Modified/Created

### Backend (Go)
```
internal/collaboration/
├── models.go                          # Already had status constants
├── service.go                         # Already had lifecycle methods
├── handler.go                         # Already had lifecycle handlers
├── repository.go                      # Already had lifecycle repo methods
├── routes.go                          # Already had lifecycle routes
├── invitation_lifecycle_test.go       # NEW - Comprehensive tests
cmd/api/main.go                        # MODIFIED - Added collaboration handler init & routes
```

### Frontend (TypeScript/React)
```
src/lib/store/collaboration/
├── collaboration.types.ts             # MODIFIED - Added lifecycle loading/error states
├── collaboration.api.ts               # MODIFIED - Added lifecycle API functions
├── collaborationSlice.ts              # MODIFIED - Added lifecycle store actions

src/components/collaboration/
├── InvitationActions.tsx              # NEW - Action buttons component
├── PendingInvitationsList.tsx          # MODIFIED - Integrated action buttons
```

### Documentation
```
INVITATION_LIFECYCLE_IMPLEMENTATION.md # NEW - Full implementation guide
INVITATION_LIFECYCLE_QUICK_START.md    # NEW - This file
```

## Key Features

### Backend Endpoints
- `POST /api/v1/collaboration/invitations/:id/resend` - Resend invitation
- `POST /api/v1/collaboration/invitations/:id/cancel` - Cancel invitation
- `POST /api/v1/collaboration/invitations/:id/accept` - Accept invitation
- `POST /api/v1/collaboration/invitations/:id/decline` - Decline invitation

### Frontend Store Actions
```typescript
// All return Promise<boolean>
await store.resendInvitation(invitationId)
await store.cancelInvitation(invitationId)
await store.acceptInvitation(invitationId)
await store.declineInvitation(invitationId)
```

### UI Components
- `InvitationActions`: Displays action buttons with confirmation dialogs
- `PendingInvitationsList`: Shows pending invitations with action buttons

## Usage Examples

### Backend - Resend Invitation
```go
service := collaboration.NewService(repo)
updated, err := service.ResendInvitation(ctx, invitationID)
if err != nil {
    // Handle error (max resends, expired, etc.)
}
// updated.ResentCount incremented
// updated.ResentAt set to now
```

### Frontend - Accept Invitation
```typescript
const store = useStore()
const success = await store.acceptInvitation(invitationId)
if (success) {
  showToast('success', 'Invitation accepted')
} else {
  showToast('error', 'Failed to accept invitation')
}
```

### Frontend - Component Usage
```tsx
import InvitationActions from '@/components/collaboration/InvitationActions'

<InvitationActions 
  invitation={invitation}
  canManage={userIsManager}
  isInvitedUser={userIsInvitee}
/>
```

## Validation Rules

| Operation | Conditions |
|-----------|-----------|
| Resend | Pending only, max 3 times, not expired |
| Cancel | Pending only, manager only |
| Accept | Pending only, not expired, creates member |
| Decline | Pending only, not expired |

## Testing

### Run Backend Tests
```bash
cd project-portal/project-portal-backend
go test ./internal/collaboration/... -v
```

### Manual Frontend Testing
1. Create an invitation
2. Test resend (should increment count, max 3)
3. Test cancel (should change status to cancelled)
4. Create new invitation
5. Test accept (should create member, change status)
6. Create new invitation
7. Test decline (should change status to declined)

## Status Transitions

```
pending → resend (stays pending, increments count)
pending → cancel → cancelled
pending → accept → accepted (creates member)
pending → decline → declined
pending (expired) → expired (auto-marked)
```

## Error Handling

All errors return appropriate HTTP status codes:
- `400 Bad Request`: Invalid state transition, max resends reached, expired
- `404 Not Found`: Invitation not found
- `500 Internal Server Error`: Database errors

Frontend automatically shows toast notifications for errors.

## Performance Considerations

- Invitations indexed by status for fast queries
- Activity logging for audit trail
- Soft deletes preserve data integrity
- No N+1 queries in list operations

## Security

- Only managers can resend/cancel
- Only invited user can accept/decline
- Expiration prevents indefinite acceptance window
- Resend limit prevents spam
- All operations logged for audit

## Troubleshooting

### Resend button disabled
- Check if max resends (3) reached
- Check if invitation expired
- Check if status is pending

### Accept/Decline buttons not showing
- Verify `isInvitedUser` prop is true
- Check if invitation status is pending
- Check if invitation expired

### Actions not working
- Check browser console for errors
- Verify auth token is set
- Check network tab for API responses
- Look for toast error messages

## Next Steps

1. **Email Notifications**: Add email sending on resend/accept/decline
2. **Expiry Job**: Add background job to mark expired invitations
3. **Bulk Operations**: Allow resending/cancelling multiple invitations
4. **Analytics**: Track invitation acceptance rates
5. **Customization**: Allow custom invitation messages

## Support

For issues or questions:
1. Check the full implementation guide: `INVITATION_LIFECYCLE_IMPLEMENTATION.md`
2. Review test cases: `invitation_lifecycle_test.go`
3. Check component props: `InvitationActions.tsx`
4. Review store actions: `collaborationSlice.ts`
