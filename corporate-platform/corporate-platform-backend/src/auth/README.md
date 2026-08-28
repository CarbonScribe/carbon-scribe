# Authentication Module

## Refresh Token Rotation & Reuse Detection

The refresh token system employs **Automatic Reuse Detection** to protect against token theft.

### Token Rotation
- Each successful call to /api/v1/auth/refresh will invalidate the provided refresh token and return a new one.
- You must save the new efreshToken securely on the client.

### Reuse Detection
- If a leaked refresh token is reused (i.e. presented to the API after it has already been rotated), the API will return a \RefreshTokenReuseError\ (HTTP 401, error code: \AUTH_010\).
- As a security measure, **all active sessions for your user account** will be immediately invalidated. You will need to log in again.

### Maximum Lifetime
- Sessions have an absolute maximum lifetime of 30 days. No amount of refreshing can extend a session beyond 30 days from its initial creation.
- Once the 30-day limit is hit, you must re-authenticate.

### Rate Limiting
- To prevent brute-forcing, sessions are temporarily locked (15 minutes) after 5 consecutive failed refresh attempts. A \SessionLockedError\ will be returned.