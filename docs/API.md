# API Reference

This document describes the public API surface of the Project Portal backend.

## Conventions

- All endpoints return JSON.
- Authentication is via bearer token where required.
- Rate-limit headers (`X-RateLimit-*`) are present on protected routes.

## Authentication

| Method | Path | Description | Limit |
|---|---|---|---|
| `POST` | `/auth/login` | Authenticate a user | 5 / 15 min / IP |
| `POST` | `/auth/register` | Register a new account | 3 / hour / IP |
| `POST` | `/auth/refresh` | Refresh an access token | 10 / hour / IP |
| `POST` | `/auth/request-password-reset` | Request a reset link | 3 / hour / IP |

## Wallet

| Method | Path | Description | Limit |
|---|---|---|---|
| `POST` | `/wallet/login` | Wallet-based login | 5 / min / IP |
| `POST` | `/wallet/challenge` | Request a signing challenge | 5 / min / IP |

## Financing

| Method | Path | Description | Limit |
|---|---|---|---|
| `POST` | `/financing/initiate-payment` | Initiate a payment | 5 / min / user/IP |

## Tokenization

| Method | Path | Description | Limit |
|---|---|---|---|
| `POST` | `/financing/tokenization/mint` | Mint a token | 10 / min / user/IP |

## Rate limiting

Protected routes enforce per-route limits backed by Redis. Responses include:

- `X-RateLimit-Limit` — the configured limit.
- `X-RateLimit-Remaining` — remaining requests in the window.
- `X-RateLimit-Reset` — when the window resets.

Exceeding a limit returns `429 Too Many Requests`. Repeated violations trigger
a graduated cooldown lock.

## Metrics

`GET /metrics` exposes Prometheus metrics, including rate-limit violation
counts per route.

## Errors

Error responses use a consistent shape:

```json
{ "error": { "code": "rate_limited", "message": "Too many requests" } }
```

Error messages are generic and never disclose internal state.
