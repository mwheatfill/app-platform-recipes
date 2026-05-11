# `webhooks/inbound-receiver`

Full inbound webhook receiver pattern: HMAC validation + optional durable archive to R2 + optional async dispatch via Cloudflare Queues. Composes with [`webhooks/hmac-validation`](../hmac-validation) (required), [`background/queue-consumer`](../../background/queue-consumer) (optional, for the dispatch path), and a future R2-archive recipe (optional, for raw-body retention).

Use when you need durable, replay-able webhook ingestion: payment events, source-control hooks, CI triggers, external system updates. For one-off webhook validation without the archive/queue path, [`webhooks/hmac-validation`](../hmac-validation) alone is enough.

## Supported templates

`template-cf-fullstack`.

## Requires

- [`webhooks/hmac-validation`](../hmac-validation) (declared in `compatibility.json`).

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/lib/webhooks/receiver.ts` | `handleInboundWebhook(source, opts)` returns `{ status, body }`. Validates the signature, optionally archives the raw body to R2, optionally enqueues the parsed message, always reads the body exactly once. |

No npm dependencies; uses Web Crypto + Cloudflare Queues + R2 bindings.

## How it works

The receiver is a pure function over `Request`:

1. Reads the configured signature header. Missing header returns 401.
2. Reads the body once.
3. Calls `verifyHmacSignature` from `webhooks/hmac-validation`. Invalid returns 401.
4. If `archive` is provided, writes the raw body to R2 at `<prefix>/<source>/<receivedAt>-<uuid>` and includes the key in the queued message.
5. If `queue` is provided, sends a `InboundWebhookMessage` with source, timestamp, headers, body, and archive key.
6. Returns `{ status: 200, body: 'OK' }`.

Caller wraps the result in a TanStack Start API route response.

## Usage

Per-source webhook secrets are required; treat a missing secret as a misconfiguration error (500), not as an automatic 401.

### Minimum: validate-only (no queue, no archive)

```ts
import { env } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'
import { handleInboundWebhook } from '@/lib/webhooks/receiver'

export const Route = createFileRoute('/api/webhooks/github')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!env.GITHUB_WEBHOOK_SECRET) {
          return new Response('Webhook secret not configured', { status: 500 })
        }
        const result = await handleInboundWebhook('github', {
          request,
          secret: env.GITHUB_WEBHOOK_SECRET,
          signatureHeader: 'x-hub-signature-256',
          signaturePrefix: 'sha256=',
        })
        return new Response(result.body, { status: result.status })
      },
    },
  },
})
```

### With queue (async dispatch)

```ts
const result = await handleInboundWebhook('github', {
  request,
  secret: env.GITHUB_WEBHOOK_SECRET,
  signatureHeader: 'x-hub-signature-256',
  signaturePrefix: 'sha256=',
  queue: env.WEBHOOK_QUEUE,
  captureHeaders: ['x-github-event', 'x-github-delivery'],
})
```

`captureHeaders` is an opt-in allowlist of header names to forward in the queued message. The default is empty because the raw request headers carry `authorization`, `cookie`, the signature itself, and Cloudflare-injected client metadata, none of which belong in downstream queue or archive storage.

The queue consumer (install [`background/queue-consumer`](../../background/queue-consumer)) picks up each `InboundWebhookMessage` and processes it asynchronously. Heavy work moves out of the receiver's request-time path so the receiver always responds within the provider's timeout.

### With queue + R2 archive

```ts
const result = await handleInboundWebhook('github', {
  request,
  secret: env.GITHUB_WEBHOOK_SECRET,
  signatureHeader: 'x-hub-signature-256',
  signaturePrefix: 'sha256=',
  queue: env.WEBHOOK_QUEUE,
  archive: { bucket: env.WEBHOOK_ARCHIVE, prefix: 'webhooks' },
})
```

The raw body lands in R2 at `webhooks/github/<receivedAt>-<uuid>` and the key is included in the queue message. The R2 put and the queue send run in parallel (no data dependency once the key is generated). The consumer can fetch the raw body from R2 if needed (replay, audit, debugging).

## Wrangler bindings

For the queue + R2 path, add to `wrangler.jsonc`:

```jsonc
{
  "queues": {
    "producers": [
      { "binding": "WEBHOOK_QUEUE", "queue": "webhooks" }
    ],
    "consumers": [
      { "queue": "webhooks", "max_batch_size": 10, "max_retries": 3 }
    ]
  },
  "r2_buckets": [
    { "binding": "WEBHOOK_ARCHIVE", "bucket_name": "webhook-archive" }
  ]
}
```

Regenerate types after editing: `pnpm cf-typegen`.

## What this recipe does NOT handle

- **The route file itself.** The receiver is a function. Mount it under your preferred route shape (`/api/webhooks/$source`, `/webhooks/$source`, etc.). One route per source is typical so each has its own secret and signature header.
- **Replay protection by timestamp.** If the provider includes a timestamp claim (Stripe, Slack), validate it before calling the receiver. Most providers want a 5-minute tolerance window.
- **Schema parsing.** The queued message carries the raw body string; consumers parse JSON (or whatever the source uses) themselves with a Zod schema appropriate to the source.
- **Per-source rate limiting.** If a source can flood you, add rate-limiting at the Cloudflare WAF or in the receiver itself.
- **Header forwarding by default.** Headers are dropped from the queued message unless `captureHeaders` is set. The signature header, `authorization`, `cookie`, and Cloudflare's client-metadata headers should never reach downstream consumers; explicit allowlist forces a conscious choice per source.

## After install

1. Install the queue and R2 bindings you'll use; create the queue + bucket via `wrangler queues create` and `wrangler r2 bucket create`.
2. Store each per-source secret via `wrangler secret put` (one per source).
3. Create a TanStack Start API route per source that calls `handleInboundWebhook`.
4. (Optional but recommended) Install [`background/queue-consumer`](../../background/queue-consumer) and write a `processOne` handler that consumes the dispatched messages.
5. Trigger a test webhook from each provider's dashboard; verify 200 + queue delivery + archive key.
