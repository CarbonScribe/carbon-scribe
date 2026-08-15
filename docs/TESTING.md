# Testing Guide

This guide covers how to run and extend the test suite for the backend.

## Running the tests

```bash
cd project-portal/project-portal-backend
go vet ./...
go test ./... -count=1
```

Run a single package:

```bash
go test ./internal/middleware/... -run TestRateLimiter -v
```

## Test categories

- **Unit tests** cover individual functions and middleware in isolation.
- **Integration tests** exercise handlers against a test database (Redis and
  Postgres are expected to be reachable, or mocked, depending on the test).
- **Boundary tests** verify limit edges (first request allowed, limit reached,
  cooldown behavior) and spatial/geographic query correctness.

## Writing tests

- Use table-driven tests for middleware with many limit combinations.
- For rate limiting, prefer a fake clock or a short expiry so tests do not rely
  on real time passing.
- For spatial queries, assert index usage where applicable (for example a GIST
  index on geometry columns) and keep fixtures small.
- Keep tests deterministic: do not depend on network access or wall-clock time.

## Database requirements

Some tests require PostGIS and Redis. If these are unavailable, the affected
tests should be skippable via a build tag or environment guard rather than
failing the whole suite.
