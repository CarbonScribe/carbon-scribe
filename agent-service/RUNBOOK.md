# Agent Service On-Call Runbook

This runbook documents response procedures for realistic failure modes of the agent-service. It is intended for on-call engineers triaging incidents affecting agent availability or reliability.

---

## Table of Contents

- [Quick Triage](#quick-triage)
- [Anthropic API Outage](#anthropic-api-outage)
- [Corporate Platform Backend Unreachable](#corporate-platform-backend-unreachable)
- [Project Portal Backend Unreachable](#project-portal-backend-unreachable)
- [Audit Database (Postgres) Unavailable](#audit-database-postgres-unavailable)
- [Escalation Paths](#escalation-paths)

---

## Quick Triage

When alerted to agent-service issues, follow this triage sequence:

1. **Check liveness probe** - confirms the service process is running:
   ```bash
   curl http://<agent-service-host>:4500/health/liveness
   ```
   Expected: `200` with `{"status":"healthy","liveness":"up"}`

2. **Check readiness probe** - identifies which dependency is unreachable:
   ```bash
   curl http://<agent-service-host>:4500/health/readiness
   ```
   Expected: `200` with all checks healthy. If `503`, inspect the `checks` object to see which dependency is failing.

3. **Check logs for error patterns** - identify the failure mode based on log signatures (see sections below).

---

## Anthropic API Outage

### How It Presents

All four agent routes (`/agents/discovery/run`, `/agents/pdd-draft/run`, `/agents/compliance-report/run`, `/agents/alert-triage/run`) return `500` errors with log messages containing `Anthropic.APIError`. Symptoms include:

- Agent requests fail immediately with API errors
- Readiness probe shows `anthropic` check as `unhealthy`
- Error patterns in logs:
  - `Anthropic.APIError` or `Error: Anthropic API error`
  - `Anthropic API check timed out` (in readiness logs)
  - `rate_limit_error` (if rate-limited)
  - `overloaded_error` (if Anthropic is degraded)

### Diagnosis Steps

1. **Check readiness probe**:
   ```bash
   curl http://<agent-service-host>:4500/health/readiness
   ```
   If `checks.anthropic.status` is `"unhealthy"`, the issue is with Anthropic reachability.

2. **Check recent logs for Anthropic errors**:
   ```bash
   # Filter for Anthropic-related errors
   grep -i "anthropic" /var/log/agent-service/app.log | tail -50
   ```

3. **Verify Anthropic API status**:
   - Check [Anthropic status page](https://status.anthropic.com/)
   - If status page shows incident, this is an upstream outage

4. **Check environment configuration**:
   - Verify `ANTHROPIC_API_KEY` is set correctly
   - Confirm no recent changes to the key or permissions

### Mitigation

**No direct mitigation exists** - agent-service cannot operate without Anthropic API access.

- **If transient**: Wait for Anthropic to recover. The readiness probe will return to healthy automatically.
- **If rate-limited**: Check if traffic has spiked unexpectedly. If legitimate high volume, consider requesting a rate limit increase from Anthropic.
- **If API key issue**: Rotate the key via environment configuration and restart the service.
- **If sustained outage (>15 min)**: Escalate to platform team to determine if agent requests should be temporarily disabled at the gateway level to prevent cascading failures.

### Prevention

- Monitor Anthropic API error rate in logs (set up alerts for `Anthropic.APIError` patterns)
- Monitor readiness probe `anthropic` check latency
- Consider implementing request queuing if rate limits are a recurring issue

---

## Corporate Platform Backend Unreachable

### How It Presents

Agent routes that depend on corporate-platform-backend (primarily `discovery` and `compliance-report`) fail with network errors or `502` responses. Symptoms include:

- Agent requests to portfolio-dependent agents fail
- Readiness probe shows `corporatePlatform` check as `unhealthy`
- Error patterns in logs:
  - `corporate-platform client request failed`
  - `network error`, `ECONNREFUSED`, `ETIMEDOUT`
  - `corporate-platform reachability check timed out` (in readiness logs)
  - `getaddrinfo ENOTFOUND` (DNS failure)

### Diagnosis Steps

1. **Check readiness probe**:
   ```bash
   curl http://<agent-service-host>:4500/health/readiness
   ```
   If `checks.corporatePlatform.status` is `"unhealthy"`, the issue is with corporate-platform-backend reachability.

2. **Check recent logs for corporate-platform client errors**:
   ```bash
   grep "corporate-platform client" /var/log/agent-service/app.log | tail -50
   ```

3. **Test direct connectivity**:
   ```bash
   curl http://<corporate-platform-host>:3000/health/liveness
   ```
   If this fails, the issue is with corporate-platform-backend itself.

4. **Check environment configuration**:
   - Verify `CORPORATE_PLATFORM_BASE_URL` is correct
   - Verify `AGENT_SERVICE_JWT_SECRET` matches corporate-platform's expectation

5. **Check for retry attempts**:
   ```bash
   grep "corporate-platform client request retry" /var/log/agent-service/app.log | tail -20
   ```
   If you see multiple retry attempts, the client is retrying on transient failures (max 2 retries with exponential backoff).

### Mitigation

**If corporate-platform-backend is down**:
- **Immediate**: No direct action in agent-service will help - this is an upstream dependency issue.
- **Triage**: Verify if corporate-platform-backend is down or just unreachable from agent-service (network/DNS issue).
- **Workaround**: If critical agent workflows are blocked, escalate to corporate-platform team.

**If network/DNS issue**:
- Check network connectivity between agent-service and corporate-platform-backend
- Verify DNS resolution for corporate-platform hostname
- Check firewall/security group rules

**If auth issue**:
- Verify `AGENT_SERVICE_JWT_SECRET` matches corporate-platform's configuration
- Check if corporate-platform's JWT middleware is rejecting the token

### Prevention

- Monitor readiness probe `corporatePlatform` check
- Monitor corporate-platform client error rate in logs
- Alert on repeated retry attempts (pattern: `corporate-platform client request retry`)

---

## Project Portal Backend Unreachable

### How It Presents

Agent routes that depend on project-portal-backend (primarily `pdd-draft` and `alert-triage`) fail with network errors or `502` responses. Symptoms include:

- Agent requests to methodology-dependent agents fail
- Alert confirmation (`confirmAlert`) fails during approval processing
- Readiness probe shows `projectPortal` check as `unhealthy`
- Error patterns in logs:
  - `project-portal client request failed` (if logging is added)
  - `network error`, `ECONNREFUSED`, `ETIMEDOUT`
  - `project-portal reachability check timed out` (in readiness logs)
  - `getaddrinfo ENOTFOUND` (DNS failure)

### Diagnosis Steps

1. **Check readiness probe**:
   ```bash
   curl http://<agent-service-host>:4500/health/readiness
   ```
   If `checks.projectPortal.status` is `"unhealthy"`, the issue is with project-portal-backend reachability.

2. **Check recent logs for project-portal errors**:
   ```bash
   grep -i "project-portal" /var/log/agent-service/app.log | tail -50
   ```

3. **Test direct connectivity**:
   ```bash
   curl http://<project-portal-host>:8080/health
   ```
   If this fails, the issue is with project-portal-backend itself.

4. **Check environment configuration**:
   - Verify `PROJECT_PORTAL_BASE_URL` is correct
   - Check if `AGENT_SERVICE_MOCK_PROJECT_PORTAL` is accidentally enabled in production

5. **Check for idempotency errors**:
   ```bash
   grep "Idempotency-Key" /var/log/agent-service/app.log | tail -20
   ```
   Idempotency key errors indicate the backend is rejecting duplicate writes.

### Mitigation

**If project-portal-backend is down**:
- **Immediate**: No direct action in agent-service will help - this is an upstream dependency issue.
- **Triage**: Verify if project-portal-backend is down or just unreachable from agent-service.
- **Workaround**: If critical agent workflows are blocked, escalate to project-portal team.

**If network/DNS issue**:
- Check network connectivity between agent-service and project-portal-backend
- Verify DNS resolution for project-portal hostname
- Check firewall/security group rules

**If idempotency key errors**:
- Check if duplicate requests are being sent (indicating a retry loop upstream)
- Verify the `requestId` being passed is unique per agent run

### Prevention

- Monitor readiness probe `projectPortal` check
- Monitor project-portal client error rate in logs
- Alert on idempotency key errors (pattern: `Idempotency-Key` in error logs)

---

## Audit Database (Postgres) Unavailable

### How It Presents

All agent routes return `500` errors with database connection errors. Unlike other failures, this surfaces as a request-level failure **immediately after the agent completes successfully** - the agent output is lost because the audit log write fails. Symptoms include:

- Agent requests return `500` even though the agent logic completed
- Error patterns in logs:
  - `connection refused`, `pool exhausted`, `connection timeout`
  - `INSERT INTO agent_audit_log` failures
  - Postgres error codes: `08006` (connection failure), `53300` (too many connections)

**Note**: This failure mode is **intentional** - `AuditLogService.record()` deliberately lets Postgres write failures propagate as request-level 500s. A spike in 500s might mean the audit database, not the agents themselves, is the actual problem.

### Diagnosis Steps

1. **Check Postgres connectivity**:
   ```bash
   # Test connection string from agent-service host
   psql $AGENT_AUDIT_DATABASE_URL -c "SELECT 1"
   ```

2. **Check recent logs for database errors**:
   ```bash
   grep -i "INSERT INTO agent_audit_log" /var/log/agent-service/app.log | tail -50
   grep -i "postgres\|connection\|pool" /var/log/agent-service/app.log | tail -50
   ```

3. **Check Postgres server status**:
   - Verify Postgres process is running
   - Check Postgres logs for connection issues
   - Check connection pool metrics (max connections, active connections)

4. **Check environment configuration**:
   - Verify `AGENT_AUDIT_DATABASE_URL` is correct
   - Verify database credentials haven't changed

5. **Check for connection pool exhaustion**:
   ```bash
   # If you have access to Postgres
   psql $AGENT_AUDIT_DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'agent_service';"
   ```

### Mitigation

**If Postgres is down**:
- **Immediate**: Restart Postgres if it crashed
- **Triage**: Check Postgres logs for crash reason (disk full, memory pressure, etc.)
- **Escalation**: If unrepairable, escalate to database team

**If connection pool exhausted**:
- **Immediate**: Check for runaway queries or connection leaks
- **Short-term**: Increase max connections in Postgres configuration if appropriate
- **Long-term**: Tune connection pool settings in agent-service (currently uses pg.Pool defaults)

**If network issue**:
- Check network connectivity to Postgres host
- Verify DNS resolution for Postgres hostname
- Check firewall/security group rules for Postgres port (5432)

**If credentials issue**:
- Verify `AGENT_AUDIT_DATABASE_URL` credentials are correct
- Check if Postgres password was rotated recently

### Prevention

- Monitor Postgres connection pool metrics
- Alert on connection pool exhaustion (connection errors in logs)
- Alert on audit log write failures (distinct from agent execution failures)
- Consider adding circuit breaker for audit log writes to allow graceful degradation

---

## Escalation Paths

### Platform Team
- Contact: [platform-team@carbon-scribe.internal]
- Responsibility: Backend services, infrastructure, dependencies
- When to escalate: Upstream backend outages (corporate-platform, project-portal), Postgres issues

### Database Team
- Contact: [database-team@carbon-scribe.internal]
- Responsibility: Postgres databases, connection pooling, migrations
- When to escalate: Audit database issues, connection pool exhaustion, migration failures

### On-Call Rotation
- Primary: [on-call-primary@carbon-scribe.internal]
- Secondary: [on-call-secondary@carbon-scribe.internal]
- PagerDuty: [link to pagerduty schedule]

### External Dependencies
- **Anthropic Support**: [support@anthropic.com] or [Anthropic status page](https://status.anthropic.com/)
- When to contact: Sustained Anthropic API outages, rate limit issues

---

## Appendix: Health Check Details

### `/health/liveness`
- **Purpose**: Confirms Express process is running
- **Always returns**: `200` if process is alive
- **Timeout**: N/A (immediate)
- **Dependency**: None

### `/health/readiness`
- **Purpose**: Checks all critical dependencies are reachable
- **Returns**: `200` if all checks healthy, `503` otherwise
- **Timeout**: 3 seconds per dependency check (parallel execution)
- **Checks**:
  - `anthropic`: Calls Anthropic Models API to verify configured model is reachable
  - `corporatePlatform`: Calls corporate-platform-backend's `/health/liveness` endpoint
  - `projectPortal`: Calls project-portal-backend's `/health` endpoint

**Example healthy response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-10-20T12:00:00.000Z",
  "uptimeSeconds": 3600,
  "checks": {
    "anthropic": {
      "status": "healthy",
      "latencyMs": 123
    },
    "corporatePlatform": {
      "status": "healthy",
      "latencyMs": 45
    },
    "projectPortal": {
      "status": "healthy",
      "latencyMs": 67
    }
  }
}
```

**Example unhealthy response**:
```json
{
  "status": "unhealthy",
  "timestamp": "2026-10-20T12:00:00.000Z",
  "uptimeSeconds": 3600,
  "checks": {
    "anthropic": {
      "status": "unhealthy",
      "error": "Anthropic API check timed out"
    },
    "corporatePlatform": {
      "status": "healthy",
      "latencyMs": 45
    },
    "projectPortal": {
      "status": "healthy",
      "latencyMs": 67
    }
  }
}
```

---

## Related Documentation

- [README.md](./README.md) - Service overview and architecture
- [LOAD_TESTING.md](./LOAD_TESTING.md) - Load testing procedures
- [APPROVAL_WORKFLOW.md](./APPROVAL_WORKFLOW.md) - Approval queue implementation details
