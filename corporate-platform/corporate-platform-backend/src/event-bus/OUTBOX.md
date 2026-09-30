# Transactional outbox

`ProducerService.publish` and `publishBatch` first write `OutboxEvent` rows. A caller that already owns a business transaction passes its Prisma client as `{ tx }`; the outbox insert then commits or rolls back with that business mutation. Without a transaction client, the producer creates the row in its own database transaction.

Rows start as `pending`. The producer attempts an immediate Kafka send when Kafka is enabled. A successful send sets `status` to `published` and records `publishedAt`. Kafka-disabled or failed sends remain pending and are retried by `OutboxService` every 10 seconds in `createdAt` order when `nextAttemptAt` is due. Attempts use exponential backoff and rows exceeding `OUTBOX_MAX_ATTEMPTS` (default `10`) become `failed`.

The Kafka message key is stable: `topic:event.id:event.type`. This preserves partitioning and gives downstream consumers an idempotency key for retries.

Operational endpoints require an authenticated user with the `admin` role:

- `GET /admin/outbox?status=pending|published|failed` lists recent rows.
- `GET /admin/outbox/metrics` reports database-backed pending/failed counts and process counters.
- `POST /admin/outbox/replay` with `{ "id": "..." }` requeues one failed row; omit `id` to requeue all failed rows.

Configure `OUTBOX_MAX_ATTEMPTS` and `OUTBOX_RETRY_DELAY_MS` to tune retry limits and the base delay.
