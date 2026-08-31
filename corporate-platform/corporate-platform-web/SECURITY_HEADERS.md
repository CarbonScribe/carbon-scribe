# Security Headers — corporate-platform-web

This document is the single source of truth for the browser-side security
headers served by the corporate platform web app. It exists so future changes
to the hosting layer (`vercel.json` or similar) do not silently conflict with
what `next.config.ts` emits.

## Where the headers are defined

All security headers are defined in [`next.config.ts`](./next.config.ts) inside
the `headers()` function (`buildSecurityHeaders()`), applied to **every route**
via:

```ts
{ source: '/(.*)', headers: buildSecurityHeaders() }
```

The existing per-asset `Cache-Control` rules are untouched and coexist with the
security rule (no header key overlaps).

## Header set

| Header | Value | Applies in |
| --- | --- | --- |
| `Content-Security-Policy` | see [CSP section](#content-security-policy) | dev + prod |
| `X-Frame-Options` | `DENY` | dev + prod |
| `X-Content-Type-Options` | `nosniff` | dev + prod |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | dev + prod |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | dev + prod |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | **production only** |

### Environment differences

- **Strict-Transport-Security** is gated behind
  `process.env.NODE_ENV === 'production'`. Sending a long `max-age` in dev
  would make browsers refuse plain `http://localhost`.
- The **dev CSP** additionally allows `'unsafe-eval'` (needed by some dev tooling)
  and `ws:` / `wss:` (Next.js hot reload). Production drops both.

## Content-Security-Policy

Production policy:

```text
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://images.unsplash.com https://*.pinata.cloud https://cdn.jsdelivr.net https://*.stellar.org;
font-src 'self' data: https://cdn.jsdelivr.net;
connect-src 'self' <NEXT_PUBLIC_API_BASE_URL>;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none'
```

Notes:

- **`img-src` mirrors `images.remotePatterns`.** If you add a host to
  `remotePatterns`, add it to `img-src` too (there is a test asserting they are
  in sync).
- **`connect-src` is built from `NEXT_PUBLIC_API_BASE_URL`** (default
  `http://localhost:4000`). API calls are therefore never blocked once the
  policy is enforced.
- **`frame-ancestors 'none'`** (plus `X-Frame-Options: DENY`) blocks
  clickjacking: the app refuses to render inside any `<iframe>`.
- `script-src` keeps `'unsafe-inline'` because Next.js injects inline bootstrap
  scripts. This is the documented minimum until a nonce strategy lands (below).

## Coordination with the deployment layer (`vercel.json`)

There is currently **no `vercel.json`** for this app — `next.config.ts` is the
only source of headers. If platform-level headers are ever added at the hosting
layer:

1. **Do not duplicate** security headers already emitted here; Vercel
   platform-level headers take precedence over Next.js config for the same key,
   so a stale copy in `vercel.json` would silently override (or drift from)
   this file.
2. If you must set a header at the platform layer, mirror the **exact** value
   from the table above and add a comment in both places pointing at this
   document.
3. Keep the `HSTS` production-only rule intact — do not promote it to
   `vercel.json` for all environments, or local preview deployments over plain
   HTTP will be affected.

## Future work

- **Nonce/hash strategy for `script-src`:** replace `'unsafe-inline'` with a
  per-request nonce (e.g. via a Next.js middleware or a custom server) so inline
  bootstrap scripts are the only inline scripts allowed. Until then, `'unsafe-inline'`
  is required and any client-side inline `<script>` will execute.
- **Report-Only rollout:** consider shipping a `Content-Security-Policy-Report-Only`
  header with a reporting endpoint (`NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT` is a
  candidate sink) before tightening further.
