# Security Review: Auth Token & Profile Persistence in Browser Storage

Tracks GitHub issue #555. Scope: `corporate-platform-web` only — see
["What didn't change, and why"](#what-didnt-change-and-why) for why the full
fix needs a `corporate-platform-backend` change that is out of scope here.

## Summary

`src/lib/auth/token-storage.ts` persists the access token, refresh token, and
(previously) the full user profile in plain `localStorage`. Anything in
`localStorage` is readable by any JavaScript running on this origin, including
a successful XSS payload — there is no `HttpOnly`, `Secure`, or `SameSite`
protection available to values stored this way, because those are cookie
attributes, not a `localStorage` concept.

This review covers what changed, what didn't, and why.

## Threat model

- **In-page XSS with arbitrary JS execution** can read anything JavaScript can
  read: `localStorage`, `sessionStorage`, IndexedDB, in-memory module
  variables, React state, `BroadcastChannel` messages — all of it. There is no
  client-side storage location that is safe from this threat once it's
  achieved, *except* an `HttpOnly` cookie, which the browser refuses to expose
  to `document.cookie` or any JS API at all.
- **Non-XSS, non-live exposure** — a compromised browser extension with
  storage-access permissions scraping in the background, forensic access to a
  device's disk/profile files after the fact, a backup or sync tool copying
  browser profile data — *can* read `localStorage` (which persists to disk)
  but generally cannot read pure in-memory JS state from a closed tab, and
  never an `HttpOnly` cookie's value directly (though it could still replay it
  if it can read the cookie jar file, which has the same OS-level protection
  as any other browser storage).
- **The server is always the actual authorization boundary.** It independently
  verifies the JWT's signature and expiry on every request. Nothing in this
  file grants access by itself — it only decides what this client presents
  and when it proactively refreshes. This matters for evaluating the
  `isTokenExpired()` change below: it improves correctness, not the security
  boundary itself.

## What changed

1. **File header comment fixed.** It previously claimed refresh tokens were
   already in `HttpOnly` cookies — they were, and still are, in `localStorage`.
   The comment now says so plainly and points here.
2. **User profile persistence minimized.** `storeUser()` now only ever writes
   `{ id, firstName, lastName }` (`MinimalStoredUser`), never the full
   `AuthUser` (`role`, `companyId`, `email`). This is enforced inside
   `storeUser()` itself — a caller passing the full profile (which is exactly
   what `AuthContext.syncProfile` does) still only gets the minimal fields
   persisted. The full profile is always re-fetched live from
   `getProfileApi()` on every hydration; the persisted copy was never anything
   more than a pre-hydration display cache, so nothing was lost.
3. **`isTokenExpired()` now derives from the JWT's own `exp` claim** (decoded
   client-side, unverified — verification is the server's job) instead of
   solely trusting `TOKEN_EXPIRY_KEY`, a separately computed, independently
   client-writable value that could silently drift from the token it's
   supposedly describing. `TOKEN_EXPIRY_KEY` remains as a fallback for a
   non-JWT (opaque) token, e.g. in tests.
   - **This is a correctness fix, not a new security boundary.** An attacker
     capable of executing arbitrary JS can already forge whatever
     `isTokenExpired()` returns by patching the function directly; deriving
     from the JWT doesn't change that. What it does fix is a real bug class:
     `TOKEN_EXPIRY_KEY` and the actual token's `exp` were two independently
     maintained values that could disagree (e.g. if `expiresIn` passed to
     `storeTokens` didn't match the token's real lifetime), and only one of
     them was ever checked.
4. **Legacy key migration removed.** `getAccessToken()` no longer looks at
   `accessToken` / `access_token` and silently adopts whatever it finds there.
   A session predating this app's current key names now just requires a fresh
   login — handled gracefully by the existing `AuthContext` init flow (see
   [Migration/rollout](#migrationrollout-notes)), not a crash.
5. **`reportError` now structurally redacts secrets** (see
   `src/lib/telemetry/errorReporter.ts`): any JWT-shaped substring found in an
   error message, an `Error`'s stack trace, or a string metadata value is
   replaced with `[REDACTED_TOKEN]`; well-known sensitive metadata keys
   (`token`, `accessToken`, `refreshToken`, `password`, `authorization`,
   `cookie`, `user`, `profile`, `jwt`) are replaced with `[REDACTED]`
   regardless of their value. Every existing `reportError` call site in this
   app was audited and none currently pass a raw token or full user object —
   this redaction makes that a structural guarantee instead of a one-time
   finding that could silently regress.

## What didn't change, and why

**The refresh token (and access token) remain in `localStorage`.** This is
the one required change from issue #555 not implemented here, and it's
worth being explicit about why, rather than papering over it with a
half-measure that looks like a fix but isn't one.

### Why not just move the refresh token to an in-memory JS variable?

This was seriously considered as a frontend-only stopgap and rejected, for
two concrete reasons:

1. **It doesn't actually reduce XSS exposure.** A module-level `let` variable
   is exactly as readable to in-page JavaScript as a `localStorage` key — an
   XSS payload doesn't care which one it reads. The only storage mechanism
   genuinely inaccessible to page JavaScript is an `HttpOnly` cookie, which by
   definition has to be set and read by the server. Moving the value from one
   JS-readable location to another JS-readable location is not a security
   improvement against the threat this issue is about.
2. **It would break existing multi-tab session behavior.** `src/lib/auth/
   cross-tab-auth.ts` (#550) coordinates refresh across open tabs via
   `BroadcastChannel` + a `localStorage`-based leader election, specifically
   *because* the refresh token currently lives in a store shared across tabs.
   Confirmed against `corporate-platform-backend/src/auth/auth.service.ts`:
   refresh tokens **do rotate** on every use (`AuthService.refresh()` bcrypt
   -compares the presented token against `session.refreshToken`, matches
   against a one-generation `previousRefreshToken` grace window otherwise,
   and issues + persists a new token either way — the automatic
   reuse-detection behavior documented in that backend's own README). An
   in-memory-per-tab refresh token would therefore silently diverge across
   tabs after any refresh: whichever tab didn't perform it keeps a stale
   token that's only good for one more grace-window use, and
   `src/lib/api/auth-http.ts`'s independent 401-triggered refresh path
   (which has no leadership coordination at all) would use it and force an
   unnecessary re-login in that tab once the grace window lapses, even
   though the user's actual session is fine elsewhere. Solving *that* would
   mean broadcasting the new refresh token to every tab on each rotation —
   which is just `localStorage` again, with extra steps, and the same XSS
   exposure.

Given neither of those is a real improvement, the honest choice was to leave
the refresh token where it is and document the residual risk explicitly,
rather than ship a change that looks like remediation without being one.

### What the real fix requires

Required Change #1 in the issue is correct: the refresh token needs to move
into an `HttpOnly`, `Secure`, `SameSite=Strict` cookie **set by the backend**.
`corporate-platform-backend` currently has no cookie-setting logic anywhere in
its auth flow — it's a pure JSON API. Implementing this properly needs:

- `Set-Cookie` on login and on refresh (the refresh endpoint reads the
  refresh token from the incoming cookie instead of a request body field).
- CSRF protection, since cookies are attached to requests automatically by
  the browser (unlike an `Authorization` header) — typically a
  double-submit token or `SameSite=Strict` plus an explicit
  state-changing-request check.
- CORS configured to allow credentials (`Access-Control-Allow-Credentials`)
  for the corporate-platform-web origin specifically (not `*`).
- `cross-tab-auth.ts`'s leader-election/`BroadcastChannel` machinery for the
  refresh token specifically could very likely be **removed** once this
  lands — cookies are shared across tabs by the browser automatically, so
  the entire reason that coordination exists today goes away for the refresh
  step. (Access-token-in-memory-per-tab plus a silent-refresh-on-load pattern,
  per Required Change #2, would then be the natural follow-up.)

This is real backend work and is out of scope for a `corporate-platform-web`
-only change. **Recommendation: track it as a follow-up issue against
`corporate-platform-backend`.**

## Cross-reference: Content-Security-Policy

`SECURITY_HEADERS.md` documents the CSP already shipped in `next.config.ts`.
It's relevant here, but should not be over-credited:

- `script-src 'self' 'unsafe-inline'` — the current policy **keeps
  `unsafe-inline`** (documented there as "the documented minimum until a
  nonce strategy lands"). This means the CSP, as it stands today, does
  **not** block the most common XSS vector (an injected inline `<script>` or
  event handler). It does block loading a remote script from an
  attacker-controlled origin, and `frame-ancestors 'none'` blocks
  clickjacking, which is real value — just not a mitigation for the classic
  reflected/stored XSS payload that this issue's threat model is about.
- Once the nonce/hash strategy referenced in `SECURITY_HEADERS.md`'s "Future
  work" section lands, CSP would meaningfully reduce (not eliminate) blast
  radius for exactly the token-theft scenario this document covers. Until
  then, treat CSP as defense-in-depth for other vectors, not as mitigating
  the localStorage exposure described here.

## Migration/rollout notes

No storage-format migration was needed for the token keys themselves (same
key names, same shape) — only the **user object's** stored shape changed
(full profile → `MinimalStoredUser`), and the **legacy accessToken/
access_token migration was removed**. Both are handled gracefully by
existing code, not a new code path:

- A session with a stale, wider `cs_user` value (from before this change):
  `getUser()` will happily return whatever's stored, including extra fields
  — those are simply ignored by the only consumer (`AuthContext`'s boolean
  existence check). No crash, no special-case needed. The next `storeUser()`
  call (on the next login, refresh, or profile sync) overwrites it with the
  minimal shape.
- A session relying on the removed legacy key migration (i.e. a value only
  under `accessToken`/`access_token`, not `cs_access_token`): `getAccessToken()`
  now returns `null` for that session. `AuthContext`'s existing init flow
  (`initAuth()`) already treats a missing access token + no refresh token as
  "not authenticated" and clears state / redirects to `/login` — this is the
  same graceful path already exercised for an ordinary expired/missing
  session, not new behavior added for this change.
- No action is required from operators or users beyond the above: at worst,
  a small number of very old sessions are asked to log in again.

## Residual risk accepted

- **Both the access token and the refresh token remain in `localStorage`**,
  readable by any script with page access (XSS, or a same-origin script
  loaded via a supply-chain compromise of any dependency). This is the
  primary residual risk from this issue and is **not** closed by this
  change. Closing it requires the backend `HttpOnly` cookie work described
  above.
- The user-profile minimization, JWT-derived expiry, legacy-migration
  removal, and telemetry redaction in this change reduce collateral exposure
  (less sensitive data sitting in storage, no silently-trusted foreign
  values, no accidental telemetry leaks) but do **not** reduce the core
  refresh-token exposure.
- Accepted pending the backend follow-up work referenced above.
