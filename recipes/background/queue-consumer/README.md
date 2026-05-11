# `background/queue-consumer`

Wires a Cloudflare Queue producer + consumer pair into `template-cf-fullstack`. App code sends via `sendToQueue(env.MY_QUEUE, body)`; the Worker consumes batches via a `queue()` handler that ack/retries per message.

Use for async work that should outlive a request: webhook fan-out, background email send, archive writes to R2, log enrichment. For time-based fires (every 5 minutes etc.), pair with [`background/cron-trigger`](../cron-trigger). For multi-step durable orchestration, pair with [`background/workflow`](../workflow).

## Supported templates

`template-cf-fullstack`.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/lib/queue/consumer.ts` | `consumeQueueBatch(batch, env, ctx, processOne)` — generic batch iterator with per-message ack/retry. Logs failures via `@/lib/log`. |
| `src/lib/queue/producer.ts` | `sendToQueue(queue, body)` and `sendBatchToQueue(queue, bodies)` — typed wrappers around the producer binding. |

No npm dependencies; Cloudflare Queues are a Workers platform primitive.

## Manual steps after install

### 1. Create the queue

```bash
pnpm exec wrangler queues create <queue-name>
pnpm exec wrangler queues create <queue-name>-dlq  # optional dead-letter queue
```

### 2. Add bindings to `wrangler.jsonc`

The producer binding is what your app code uses to `send()`. The consumer binding is what tells the Worker to receive batches from the queue.

```jsonc
{
  "queues": {
    "producers": [
      { "binding": "MY_QUEUE", "queue": "my-queue" }
    ],
    "consumers": [
      {
        "queue": "my-queue",
        "max_batch_size": 10,
        "max_batch_timeout": 30,
        "max_retries": 3,
        "dead_letter_queue": "my-queue-dlq"
      }
    ]
  }
}
```

After editing, regenerate the env types: `pnpm cf-typegen`.

A Worker can have many producer + consumer bindings; one queue can only have one active consumer.

### 3. Expose the `queue` export from the Worker entry

Add to `src/server.ts` (create one repointing `wrangler.jsonc` `main` if you don't have one yet; see the [`monitoring/sentry`](../../monitoring/sentry) recipe for the wrapped-entry pattern).

```ts
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { consumeQueueBatch } from '@/lib/queue/consumer'

interface MyMessage {
  jobId: string
}

async function processOne(_message: Message<MyMessage>, _env: Cloudflare.Env, _ctx: ExecutionContext) {
  // Replace with real processing. Throw to retry; return to ack.
}

export default {
  ...createServerEntry({
    fetch(request) {
      return handler.fetch(request)
    },
  }),
  async queue(batch: MessageBatch<MyMessage>, env: Cloudflare.Env, ctx: ExecutionContext) {
    await consumeQueueBatch(batch, env, ctx, processOne)
  },
}
```

If [`monitoring/sentry`](../../monitoring/sentry) is installed, your default export is already `Sentry.withSentry(...)`. Attach `queue` to the wrapped default with object spread; see the [`monitoring/sentry` README](../../monitoring/sentry/README.md) for the composed shape.

### 4. Send messages from app code

```ts
import { env } from 'cloudflare:workers'
import { sendToQueue } from '@/lib/queue/producer'

await sendToQueue(env.MY_QUEUE, { jobId: '123' })
```

## Dead-letter queue

When a message exceeds `max_retries`, it's delivered to the configured `dead_letter_queue` (a regular queue). Configure a separate consumer for the DLQ to inspect or reprocess. Without a DLQ, exhausted messages are dropped.

Messages on a DLQ without an active consumer persist for 4 days, then are deleted.

## What this recipe does NOT handle

- **Queue authorization.** Anyone with the producer binding can send; the binding itself is the access control. Don't expose it via HTTP without app-level auth.
- **Ordering.** Queues guarantee at-least-once delivery but not order. If you need ordering, build it into the message payload (sequence number) or use a single Durable Object per ordered stream.
- **Exactly-once semantics.** Design consumers to be idempotent. Same message can arrive twice.
- **Cross-Worker queues.** One queue can have one consumer Worker. If you need to fan out to multiple consumers, use multiple queues or a Durable Object as the fan-out point.

## Pattern

App code sends via `sendToQueue`. The Worker's `queue()` export consumes via `consumeQueueBatch`. Failures log through `@/lib/log` and retry through the platform until `max_retries` is hit, then the message goes to the DLQ. Messages process in parallel inside a batch with independent ack/retry; keep `processOne` idempotent.

For advanced producer options (per-message `contentType`, `delaySeconds`), call `env.MY_QUEUE.send` / `sendBatch` directly with `MessageSendRequest<T>` objects; the helpers in `producer.ts` cover the common case.

## Multi-queue routing

A Worker can consume from multiple queues with one `queue` export. `batch.queue` carries the queue name:

```ts
async queue(batch: MessageBatch<unknown>, env: Cloudflare.Env, ctx: ExecutionContext) {
  switch (batch.queue) {
    case 'dispatch':
      return consumeQueueBatch(batch as MessageBatch<DispatchMessage>, env, ctx, processDispatch)
    case 'webhooks':
      return consumeQueueBatch(batch as MessageBatch<InboundWebhookMessage>, env, ctx, processWebhook)
    default:
      // Unknown queue name; ack all rather than retry forever.
      batch.ackAll()
  }
}
```

The cast is necessary because `MessageBatch<unknown>` is the union over both queue types. Each branch owns its narrow type.

## Idempotency

Queues delivers at-least-once. Duplicate messages will arrive. Make `processOne` idempotent at the business-operation level:

- For "execute scheduled job" messages, key on the job-run ID and write a row to D1 inside a transaction; the unique constraint short-circuits duplicates.
- For "send notification" messages, key on a stable composite (`source + event_id + recipient`) and check before sending.
- For pure side-effect-free transforms (read X, derive Y, write to R2 at deterministic path), idempotency is free.

## Final-attempt handling

To take a different action on the last attempt before the message DLQs (write a `failed` row to D1, emit a critical-severity log, page on-call), check `message.attempts` against the consumer's configured `max_retries`:

```ts
async function processOne(message: Message<DispatchMessage>, env: Cloudflare.Env, _ctx: ExecutionContext) {
  try {
    await executeJob(message.body, env)
  } catch (err) {
    if (message.attempts >= MAX_RETRIES) {
      await markFailedInDb(env.DB, message.body.jobId, err)
    }
    throw err // re-throw so consumeQueueBatch calls retry()
  }
}
```

Keep `MAX_RETRIES` in sync with `wrangler.jsonc`'s `max_retries`. The platform will deliver the DLQ message itself; the final-attempt branch above is for app-level bookkeeping before the DLQ delivery.

## After install

1. Create the queue (and optional DLQ) via `wrangler queues create`.
2. Add `queues.producers` and `queues.consumers` to `wrangler.jsonc`.
3. Regenerate types: `pnpm cf-typegen`.
4. Add the `queue` export to `src/server.ts` (creating one if not present).
5. Verify by sending a test message via `sendToQueue(env.MY_QUEUE, {...})` and checking the consumer logs.
