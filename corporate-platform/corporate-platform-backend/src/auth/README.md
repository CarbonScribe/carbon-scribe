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

## JWT Secret Configuration

`JWT_SECRET` is resolved exclusively through `ConfigService.getAuthConfig().jwtSecret` — `AuthModule`'s `JwtModule` and `JwtStrategy` both read from it via constructor/factory injection, and nothing in this codebase should read `process.env.JWT_SECRET` directly (a startup scan in `src/config/jwt-secret-env-scan.spec.ts` enforces this).

- There is no default value. An unset `JWT_SECRET` fails config validation on boot in every environment, not just production.
- In production, and in any environment whose `NODE_ENV`, `SERVICE_NAME`, or `DEPLOY_ENV` indicates a shared/staging deployment, the secret must additionally be at least 32 characters and must not match a known placeholder pattern (`dev-`, `test-`, `change-me`, etc.).
- `JwtSecretConsistencyValidator` runs on module init and fails startup if `JwtModule`'s signing secret ever diverges from `ConfigService.getAuthConfig().jwtSecret`.

### Secret Rotation Procedure

`JwtModule` is currently configured with a single active secret, so rotating it invalidates every outstanding access and refresh token the moment the new secret is deployed. To rotate without forcing every user to re-authenticate simultaneously, use a dual-secret verification window:

1. **Generate the new secret.** `openssl rand -hex 32` (or equivalent). Never reuse a retired secret.
2. **Deploy in verify-both mode.** Before switching `JWT_SECRET` to the new value, deploy a change that accepts tokens signed with either the old or the new secret when verifying (e.g. by trying `jwtService.verify(token, { secret: newSecret })` and falling back to `jwtService.verify(token, { secret: oldSecret })` on failure), while all *new* tokens continue to be signed with the old secret.
3. **Switch signing to the new secret.** Update `JWT_SECRET` to the new value and redeploy. Existing tokens signed with the old secret remain valid for the rest of the window because of step 2; all new tokens are signed with the new secret.
4. **Hold the window.** Keep verify-both active for at least the longest-lived token you issue (refresh tokens currently live up to 7 days per token, 30 days absolute session lifetime — see above). This gives every active session a chance to refresh onto a new-secret-signed token.
5. **Retire the old secret.** Once the window has passed, remove the old secret from verify-both and redeploy signing/verification against the new secret only. Confirm `JwtSecretConsistencyValidator` still passes.

Rotate immediately (skip the window and accept forced re-authentication) if the current secret is known or suspected to be compromised.