# Environment Configuration

This app validates its public (`NEXT_PUBLIC_*`) configuration at build time so a
missing or malformed value fails fast during `next build` instead of surfacing as
a cryptic network error in production.

- Validator: [`src/lib/env/validate.ts`](./src/lib/env/validate.ts)
- Build/dev integration: [`next.config.ts`](./next.config.ts)
- Template: [`.env.example`](./.env.example)

## How it runs

`next.config.ts` calls `assertPublicEnv()` on load, which means validation runs
for both `next build` and `next dev`:

| Command      | NODE_ENV      | Behaviour                                              |
| ------------ | ------------- | ----------------------------------------------------- |
| `next build` | `production`  | **Strict** — missing/invalid required vars throw and fail the build. |
| `next dev`   | `development` | Warnings and errors are logged; the dev server still starts (built-in fallbacks apply). |

Set `SKIP_ENV_VALIDATION=1` to bypass validation entirely (for tooling that
intentionally builds without runtime config).

## Required variables

These must be valid `http(s)` URLs. A production build fails if any is missing or
malformed.

| Variable                                | Purpose                                              |
| --------------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`              | Backend API base URL, consumed by `src/lib/api/*`.  |
| `NEXT_PUBLIC_API_URL`                   | Backend API URL, consumed by `src/services/*` and `src/lib/teamApi.ts`. |
| `NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL` | Stellar blockchain explorer base URL.               |

> Note: the codebase currently reads two API URL variables in different layers
> (`NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_API_URL`). Both are validated so
> runtime API calls cannot fail due to one being unset. Consolidating them into a
> single variable is a reasonable follow-up.

## Optional variables (warnings only)

These never fail the build; they emit a warning if present but malformed.

| Variable                            | Rule                                              |
| ----------------------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_ENVIRONMENT`           | One of `development`, `staging`, `production`.     |
| `NEXT_PUBLIC_APP_NAME`              | Non-empty string when set.                        |
| `NEXT_PUBLIC_SENTRY_DSN`            | Valid URL when set.                               |
| `NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT` | Valid URL when set.                            |
| Numeric tuning vars (retry, connectivity, session, error rate-limit) | Non-negative number when set. |

All URL variables also warn on a trailing slash, which can produce double-slash
request paths.

## Examples

### Valid

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.carbonscribe.example
NEXT_PUBLIC_API_URL=https://api.carbonscribe.example
NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL=https://stellar.expert/explorer/public/tx
```

### Failing build (clear error)

With `NEXT_PUBLIC_API_URL` unset, `next build` aborts:

```
[env] Public environment validation failed with 1 error(s):
  - NEXT_PUBLIC_API_URL is required but is missing or empty.

Set these variables in your environment or .env file.
See .env.example and ENVIRONMENT.md for the full list and rules.
```

## Local setup

```bash
cp .env.example .env.local
# edit values, then:
npm run dev
```
