# Deployment Guide

This document describes how to build, configure, and run the Project Portal
backend.

## Build

```bash
cd project-portal/project-portal-backend
go build -o bin/api ./cmd/api
```

## Configuration

Configuration is environment-driven. The following variables control the
backend's behavior:

| Variable | Purpose | Required |
|---|---|---|
| `HTTP_ADDR` | Listen address | yes |
| `REDIS_URL` | Redis connection string (rate limiting) | yes |
| `DATABASE_URL` | Postgres connection string | yes |
| `RATE_LIMIT_LOGIN` | Login limit per IP | no |
| `RATE_LIMIT_MINT` | Mint limit per user/IP | no |
| `INTERNAL_IP_WHITELIST` | IPs that bypass limits | no |

## Running

```bash
./bin/api
```

For containerized deployments, pass configuration through environment
variables and expose the `/metrics` and health endpoints.

## Redis requirements

Rate limiting is Redis-backed so limits are shared across horizontally-scaled
instances. Redis must be reachable from every instance; a Redis outage fails
closed on protected routes (requests are rejected rather than allowed without
limits).

## Scaling

Because rate-limit state lives in Redis, the API scales horizontally. Run
multiple instances behind a load balancer; per-IP and per-user limits remain
consistent across instances.

## Health & metrics

- A liveness endpoint returns `200` when the process is serving.
- `/metrics` exposes Prometheus metrics, including rate-limit violation counts.

## Rollback

Deployments are stateless (state lives in Postgres and Redis), so rollback is
a redeploy of the previous image. Keep the previous image tag in the deploy
runbook.

## Common issues

| Symptom | Cause | Action |
|---|---|---|
| 429s everywhere | Redis unreachable | Restore Redis; routes fail closed |
| Rate limits not shared | Instances not using same Redis | Verify `REDIS_URL` on all instances |
| Slow spatial queries | Missing GIST index | Verify geometry columns are indexed |
