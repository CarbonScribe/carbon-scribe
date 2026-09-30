# Human Approval Workflow

## Queue and API

Every agent controller persists a `needs-approval` result and a JSON snapshot
of its original run input before returning the result. The snapshot is stored
as `original_input` on `agent_approval_requests`; legacy rows can have a null
snapshot, which makes an action requiring that target fail clearly rather than
being dispatched without context.

The queue is stored in agent-service's PostgreSQL database. Pending work is
available at `GET /approvals`. A reviewer decision is one-way:

- `POST /approvals/:requestId/approve` with `{ "reviewerId": "..." }`
- `POST /approvals/:requestId/reject` with `{ "reviewerId": "..." }`

Both operations require a valid internal service JWT and an issuer listed in
`APPROVAL_REVIEWER_SERVICES`. Unknown requests return `404`; already-decided
requests return `409`; valid but non-allowlisted services return `403`.

## Trust Model

The internal JWT authenticates the calling service. Its verified `iss` is
stored as `reviewer_calling_service` on the approval decision, and as
`calling_service` in the corresponding audit row. `reviewerId` is a
service-asserted human identity supplied by that allowlisted service; it is
not a verified human claim in the agent-service token. The upstream service
must authenticate the human and verify their role before forwarding the
decision. Agent-service does not trust an unsigned role field or enforce a
role inferred from request JSON. Signed reviewer claims and direct role
verification require a separately agreed auth contract and remain a tracked
follow-up.

## Outbox Dispatch

Approval changes the request state, writes the decision audit event, and
inserts exactly one outbox action in the same PostgreSQL statement. Rejection
does not insert an outbox action. The outbox stores the action type, original
result payload, original input as `target`, reviewer ID, and verified calling
service.

The startup dispatcher claims due rows atomically using PostgreSQL
`FOR UPDATE SKIP LOCKED`. Two service instances therefore do not claim the
same available row. Rows move through `pending` -> `processing` ->
`processed` or `failed`. A processing lease that expires can be reclaimed;
rows at the attempt limit are terminally failed. A failed attempt below the
limit returns to `pending` with exponential backoff, capped by
`APPROVAL_OUTBOX_RETRY_MAX_MS`. The default limit is five attempts. Each
processed, retried, and terminally failed dispatch writes an audit row linked
to the original `requestId`.

Each handler receives the outbox row ID as `ctx.idempotencyKey`, unchanged
across attempts. Handlers that perform external effects must use this key to
deduplicate redelivery (for example, persist it at the destination). A handler
failure after an effect but before acknowledgement is retried with the same
key. Unknown action types are marked failed with a descriptive `last_error`
and are never silently discarded.

### Adding a Handler

Implement `ApprovedActionHandler.handle(action, ctx): Promise<void>` and
register the handler in `src/shared/outbox/index.ts` under the exact action
type. Throw `PermanentActionError` for non-retryable data/contract failures;
other errors are retried. The alert escalation handler reads its target from
the input snapshot and uses the injected `EscalationNotifier`. Its current
default is logging only. TODO: the real project-portal notification adapter
is tracked in the related escalation-wiring issue; this service does not invent
or call an unverified project-portal API.

## Environment

- `APPROVAL_REVIEWER_SERVICES`: comma-separated trusted service issuers; empty
  by default, which denies approval operations.
- `APPROVAL_OUTBOX_POLL_INTERVAL_MS`: poll interval, default `3000`.
- `APPROVAL_OUTBOX_BATCH_SIZE`: claim batch size, default `20`.
- `APPROVAL_OUTBOX_MAX_ATTEMPTS`: maximum handler attempts, default `5`.
- `APPROVAL_OUTBOX_LOCK_TIMEOUT_MS`: processing lease, default `60000`.
- `APPROVAL_OUTBOX_RETRY_BASE_MS`: exponential backoff base, default `1000`.
- `APPROVAL_OUTBOX_RETRY_MAX_MS`: backoff cap, default `60000`.

All database migrations, including `003_extend_approval_outbox.sql`, run
idempotently at agent-service startup before the HTTP server and dispatcher
start.