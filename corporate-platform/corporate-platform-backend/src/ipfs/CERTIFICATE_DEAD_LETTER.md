# Certificate Anchoring Dead-Letter & Recovery (#400)

Persists actionable failure state for certificate IPFS anchoring so failed
uploads can be retried or repaired without manual database forensics. This
prevents certificate generation failures from becoming silent data loss and
enables operational recovery without engineering intervention.

## Components

| Piece | File | Responsibility |
| --- | --- | --- |
| Failure store | `services/certificate-dead-letter.service.ts` | Records, de-duplicates, lists, claims, and resolves failure records. |
| Retry scheduler | `services/certificate-retry-scheduler.service.ts` | `@Cron` sweep that reprocesses due records with capped exponential backoff. |
| Notifications | `services/certificate-failure-notification.service.ts` | Alerts support when the unresolved backlog crosses a threshold. |
| Integration | `services/certificate-ipfs.service.ts` | `anchorCertificate` dead-letters on failure; `performAnchor` is the retriable unit. |
| Admin API | `certificate-failure.controller.ts` | List / inspect / retry / resolve. Admin-only. |
| Model | `prisma/schema.prisma` → `CertificateAnchorFailure` (`certificate_anchor_failures`) | Persistent failure record. |

## Failure record schema

`CertificateAnchorFailure` stores everything needed for recovery:

- `id` — unique identifier.
- `retirementId` — retirement reference (nullable / "if applicable").
- `companyId` — owning company, for scoping/filtering.
- `certificateData` — JSON payload of the certificate being anchored.
- `attemptCount` — number of retry attempts made.
- `lastError` — error message from the last failure.
- `lastAttemptAt` — timestamp of the last attempt.
- `status` — `pending` | `in_progress` | `failed` | `resolved`.
- `nextRetryAt` — timestamp for the next scheduled retry.
- `resolvedCid` — CID produced once anchoring succeeds.
- `createdAt` — timestamp of initial failure.
- `resolvedAt` — timestamp when resolved.

## Lifecycle

1. `CertificateIpfsService.anchorCertificate` calls `performAnchor`. On any error
   (including `upload()` returning an error envelope) the attempt is recorded via
   `CertificateDeadLetterService.recordFailure`. A recurring failure for the same
   `retirementId` updates the existing unresolved record instead of duplicating.
2. The scheduler (`@Cron`, every minute) selects `pending` records whose
   `nextRetryAt` is due and whose `attemptCount < maxAttempts`, claims each one
   (`in_progress`, guarding against overlapping runs), and re-anchors it.
   - Success → `resolved` (with `resolvedCid`).
   - Failure → `attemptCount++`, backoff reschedule, or `failed` once the budget
     is exhausted.
3. After each sweep, the notification service alerts support if the unresolved
   backlog meets/exceeds the configured threshold.

## Admin endpoints

Base path: `/api/v1/ipfs/certificate-failures` — authenticated **admin** only
(`JwtAuthGuard` + `RolesGuard`, `@Roles('admin')`).

- `GET /` — list failures. Query: `status`, `companyId`, `retirementId`,
  `limit` (1–200, default 50), `offset`. Returns `{ items, total, limit, offset }`.
- `GET /:id` — fetch a single failure record with full recovery context.
- `POST /:id/retry` — requeue and immediately reprocess; returns `{ outcome, record }`.
- `POST /:id/resolve` — mark resolved without retrying (repaired out of band).

## Configuration

All knobs are environment variables with safe defaults (see
`interfaces/certificate-failure.interface.ts`):

| Variable | Default | Meaning |
| --- | --- | --- |
| `CERT_ANCHOR_RETRY_ENABLED` | `true` | Set to `false` to disable the scheduled sweep. |
| `CERT_ANCHOR_RETRY_MAX_ATTEMPTS` | `5` | Automatic attempts before a record is marked `failed`. |
| `CERT_ANCHOR_RETRY_BASE_DELAY_MS` | `60000` | Base backoff delay. |
| `CERT_ANCHOR_RETRY_BACKOFF_MULTIPLIER` | `2` | Exponential multiplier. |
| `CERT_ANCHOR_RETRY_MAX_DELAY_MS` | `3600000` | Cap on computed backoff. |
| `CERT_ANCHOR_ALERT_THRESHOLD` | `10` | Unresolved-failure count that triggers an alert. |
| `CERT_ANCHOR_ALERT_WEBHOOK_URL` | _unset_ | Optional webhook for threshold alerts (otherwise warn-level log). |

## Tests

- `interfaces/certificate-failure.interface.spec.ts` — backoff/config helpers.
- `services/certificate-dead-letter.service.spec.ts` — record/dedupe/claim/resolve/budget.
- `services/certificate-retry-scheduler.service.spec.ts` — sweep + per-record outcomes.
