# Operations Runbook

This runbook covers common operational tasks for the backend.

## Health checks

- Liveness: `GET /health` returns `200` when the process is serving.
- Metrics: `GET /metrics` exposes Prometheus metrics.

## Monitoring

Monitor the following signals:

- **Rate-limit violations** (Prometheus counter per route) — a sustained spike
  indicates an abuse campaign or a misconfigured client.
- **Redis connectivity** — rate limiting fails closed if Redis is unreachable.
- **Spatial query latency** — verify geometry columns have their GIST index.

## Alerting

| Alert | Threshold | Response |
|---|---|---|
| High 429 rate | > 2x baseline | Investigate abuse source |
| Redis down | any | Restore Redis immediately |
| Slow spatial queries | > 1s p99 | Verify GIST index presence |

## Incident response

1. Check Redis and database health.
2. Confirm the rate-limit configuration matches the runbook defaults.
3. Inspect logs for the affected route and client.
4. Adjust limits or add a temporary IP block if under active attack.

## Rate-limit tuning

Limits are environment-driven. To change a limit, update the corresponding
environment variable and redeploy. Document the change in the runbook so the
team knows the new baseline.

## Backup & restore

State lives in Postgres and Redis. Follow the standard database backup
schedule; Redis is treated as ephemeral (rate-limit counters) and does not
require backup.
