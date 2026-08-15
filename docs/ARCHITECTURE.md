# Backend Architecture

This document describes the architecture of the Project Portal backend and the
cross-cutting concerns that protect its API surface.

## Structure

```
project-portal/project-portal-backend/
  cmd/api/             entrypoint + HTTP server wiring
  internal/
    auth/              authentication handlers and routes
    config/            environment-driven configuration
    financing/         financing domain logic
      tokenization/    token minting flow
    middleware/        cross-cutting HTTP middleware
```

## Request lifecycle

```
client request
    |
    v
rate-limit middleware (per-route, Redis-backed)
    |
    v
authentication middleware (when required)
    |
    v
route handler (domain logic)
    |
    v
response
```

## Cross-cutting concerns

### Rate limiting

The API enforces per-route limits backed by Redis, which allows the limits to
be shared across horizontally-scaled instances. Key properties:

- **Per-endpoint limits** are configured through environment variables so they
  can be tuned without a code change.
- **Per-IP and per-user keys** are used depending on the route. Authentication
  routes are keyed by IP; account-scoped routes (e.g. minting) may be keyed by
  user.
- **Cooldown locks** apply graduated backoff to repeated violations.
- **Response headers** (`X-RateLimit-Limit`, `X-RateLimit-Remaining`,
  `X-RateLimit-Reset`) expose limit state to clients.
- **Whitelist** support allows internal services to bypass public limits.

### Observability

Rate-limit violations are exported as Prometheus metrics and exposed on the
`/metrics` endpoint so operators can alert on abuse patterns.

## Adding a new protected route

1. Define the limit for the route in configuration.
2. Wrap the route with the rate-limit middleware, choosing an IP or user key.
3. Add a test that asserts the limit is enforced (including the cooldown path).
4. Document the limit in the runbook so operators know how to tune it.
