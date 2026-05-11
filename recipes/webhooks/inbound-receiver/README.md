# `webhooks/inbound-receiver`

Full inbound webhook receiver pattern: HMAC validation, optional replay-window check, optional KV-backed idempotency dedup, optional durable archive to R2, optional async dispatch via Cloudflare Queues. Composes with [`webhooks/hmac-validation`](../hmac-validation) (required), [`background/queue-consumer`](../../background/queue-consumer) (optional), and any R2 bucket binding for raw-body retention.

Use when you need durable, replay-protected, idempotent webhook ingestion: payment events, source-control hooks, CI triggers, external system updates. For one-off webhook validation without the archive/queue path, [`webhooks/hmac-validation`](../hmac-validation) alone is enough.

## Supported templates

`template-cf-fullstack`.

## Requires

- [`webhooks/hmac-validation`](../hmac-validation) (declared in `compatibility.json`).

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/lib/webhooks/receiver.ts` | `handleInboundWebhook(source, opts)` returns `{ status, body }`. |

No npm dependencies; uses Web Crypto + (optional) Cloudflare Queues + R2 + KV bindings.

## How it works

The receiver is a pure function over `Request`. Order of checks:

1. Signature header present? Else 401.
2. Replay window (if option set): is the supplied timestamp within `maxAgeSeconds` of `Date.now()`? Else 401. Cheap check before HMAC.
3. HMAC valid? Else 401.
4. Idempotency (if option set): has the key header been seen in KV? If yes, return 200 without re-processing.
5. Archive to R2 (if option set) and enqueue (if option set) in parallel via `Promise.all`.
6. Mark idempotency key in KV (after work succeeds, so failed processing retries).
7. Return 200.

## Usage

Per-source webhook secrets are required; treat a missing secret as a misconfiguration error (500), not as an automatic 401.

### Minimum: validate-only

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

### Production-shaped: replay + idempotency + queue + archive

```ts
const deliveryId = request.headers.get('x-github-delivery')
const result = await handleInboundWebhook('github', {
  request,
  secret: env.GITHUB_WEBHOOK_SECRET,
  signatureHeader: 'x-hub-signature-256',
  signaturePrefix: 'sha256=',
  // GitHub doesn't ship a timestamp; Stripe and Slack do. See below.
  idempotency: {
    kv: env.WEBHOOK_DEDUP,
    keyHeader: 'x-github-delivery',
    ttlSeconds: 24 * 60 * 60,
  },
  captureHeaders: ['x-github-event', 'x-github-delivery'],
  queue: env.WEBHOOK_QUEUE,
  archive: { bucket: env.WEBHOOK_ARCHIVE, prefix: 'webhooks' },
})
```

### Replay window (Stripe / Slack)

Stripe's timestamp lives inside the signature header (`Stripe-Signature: t=<ts>,v1=<sig>`); Slack's is a separate header (`X-Slack-Request-Timestamp`). The caller extracts the unix-seconds value and passes it; the receiver compares against `Date.now()`:

```ts
const header = request.headers.get('stripe-signature') ?? ''
const parts = header.split(',').flatMap((p) => {
  const eq = p.indexOf('=')
  return eq === -1 ? [] : [[p.slice(0, eq), p.slice(eq + 1)] as [string, string]]
})
const timestamp = Number(parts.find(([k]) => k === 't')?.[1] ?? 0)

const result = await handleInboundWebhook('stripe', {
  request,
  secret: env.STRIPE_WEBHOOK_SECRET,
  signatureHeader: 'stripe-signature',
  replayWindow: { timestamp, maxAgeSeconds: 5 * 60 },
  queue: env.WEBHOOK_QUEUE,
  archive: { bucket: env.WEBHOOK_ARCHIVE, prefix: 'webhooks' },
})
```

Stripe (and Slack) carry the event id in the body, not a header. The receiver's header-based `idempotency` option doesn't fit; dedup happens at the queue-consumer side instead by reading `event.id` from the parsed body and checking against a D1 table or KV. For providers with a header-based delivery id (GitHub's `X-GitHub-Delivery`), the receiver's `idempotency` option does the dedup at the edge.

For Stripe, the receiver passes the full `stripe-signature` value through to `verifyHmacSignature`. To take advantage of Stripe's signature rotation (multiple `v1=` entries during secret roll), pre-parse the header and call `verifyHmacSignature` directly with the `v1` values as a `string[]`, then call the receiver with a thinner signature option.

## Wrangler bindings

For the full path, add to `wrangler.jsonc`:

```jsonc
{
  "queues": {
    "producers": [{ "binding": "WEBHOOK_QUEUE", "queue": "webhooks" }],
    "consumers": [
      { "queue": "webhooks", "max_batch_size": 10, "max_retries": 3 }
    ]
  },
  "r2_buckets": [
    { "binding": "WEBHOOK_ARCHIVE", "bucket_name": "webhook-archive" }
  ],
  "kv_namespaces": [
    { "binding": "WEBHOOK_DEDUP", "id": "<kv-namespace-id>" }
  ]
}
```

Create the KV namespace via `wrangler kv namespace create webhook-dedup`. Regenerate types after editing: `pnpm cf-typegen`.

## Caveats

- **KV is eventually consistent.** Idempotency dedup is best-effort across edge POPs in the first few seconds. For strict at-once dedup, use a Durable Object instead (a future recipe).
- **Idempotency key is written after work succeeds.** Transient failures retry; the same provider-side retry can arrive before our write completes. Design `processOne` (your queue consumer) to be idempotent regardless.
- **`idempotency` only works for providers whose delivery id is in a request header.** GitHub (`X-GitHub-Delivery`) fits. Stripe and Slack put the event id in the body; dedup for those happens at the consumer after JSON parse, not at the receiver.
- **HTTP method enforcement is the caller's job.** The receiver doesn't reject non-POST methods. Wire it under a POST-only route handler.

## What this recipe does NOT handle

- **The route file itself.** One route per source is typical so each has its own secret and signature header.
- **Schema parsing.** The queued message carries the raw body string; consumers parse it themselves.
- **Per-source rate limiting.** Add at the Cloudflare WAF or in the receiver itself.
- **Header forwarding by default.** Headers are dropped from the queued message unless `captureHeaders` is set. The signature header, `authorization`, `cookie`, and Cloudflare's client-metadata headers should never reach downstream consumers; explicit allowlist forces a conscious choice per source.

## After install

1. Create the queue, R2 bucket, and (optional) KV namespace via wrangler commands.
2. Add the bindings to `wrangler.jsonc`; `pnpm cf-typegen`.
3. Store each per-source secret via `wrangler secret put`.
4. Create a TanStack Start API route per source that calls `handleInboundWebhook`.
5. Install [`background/queue-consumer`](../../background/queue-consumer) and write a `processOne` handler that consumes the dispatched messages. Keep `processOne` idempotent.
6. Trigger a test webhook from each provider's dashboard; verify 200 + queue delivery + archive key + dedup on retry.
