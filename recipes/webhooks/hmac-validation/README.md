# `webhooks/hmac-validation`

HMAC signature verification for inbound webhooks. Single helper, no dependencies, uses Workers' Web Crypto API. Supports SHA-256 / SHA-384 / SHA-512, single or rotating signatures, and an optional prefix strip. The pair recipe [`webhooks/inbound-receiver`](../inbound-receiver) builds on top of this for the full "receive → validate → enqueue → archive" pattern.

Use when you're accepting webhooks from a provider that signs payloads with HMAC: GitHub, Stripe, Slack, GitLab, Cloudflare itself, most CI providers, most payment providers. For non-HMAC signature schemes (RSA, Ed25519) you'll need a different recipe.

## Supported templates

`template-cf-fullstack`.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/lib/webhooks/hmac.ts` | `verifyHmacSignature({ payload, signature, secret, algorithm?, prefix? })` returns a `Promise<boolean>`. Uses `crypto.subtle.verify` (timing-safe). |

No npm dependencies; Web Crypto is built into Workers.

## How it works

Web Crypto's `crypto.subtle.verify` performs constant-time comparison internally. The helper:

1. Resolves the algorithm (default `SHA-256`).
2. Strips an optional `prefix` from the signature (`sha256=` for GitHub, `v1=` for Stripe, etc.).
3. Hex-decodes the remaining signature to bytes.
4. Imports the secret as an HMAC key (cached per `secret+algorithm` at module scope so the import runs once per isolate).
5. Calls `crypto.subtle.verify('HMAC', key, sigBytes, payloadBytes)`. Returns `true` on the first match when multiple signatures are supplied.

Returns `false` on any decode failure rather than throwing, so route handlers branch on a single boolean.

## Usage

### GitHub (`X-Hub-Signature-256: sha256=<hex>`)

```ts
import { env } from 'cloudflare:workers'
import { verifyHmacSignature } from '@/lib/webhooks/hmac'

const signature = request.headers.get('x-hub-signature-256') ?? ''
const body = await request.text()
const valid = await verifyHmacSignature({
  payload: body,
  signature,
  secret: env.GITHUB_WEBHOOK_SECRET,
  prefix: 'sha256=',
})
```

### Stripe (`Stripe-Signature: t=<ts>,v1=<hex>[,v1=<hex>]`)

Stripe signs `<timestamp>.<body>` and may include multiple `v1=` entries during a secret rotation. Parse the header, pass every `v1` value as the signature array:

```ts
const header = request.headers.get('stripe-signature') ?? ''
const parts = header.split(',').flatMap((p) => {
  const eq = p.indexOf('=')
  return eq === -1 ? [] : [[p.slice(0, eq), p.slice(eq + 1)] as [string, string]]
})
const timestamp = parts.find(([k]) => k === 't')?.[1] ?? ''
const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v)
const body = await request.text()
const valid = await verifyHmacSignature({
  payload: `${timestamp}.${body}`,
  signature: signatures,
  secret: env.STRIPE_WEBHOOK_SECRET,
})
```

Also reject stale timestamps to prevent replay attacks (Stripe recommends a 5-minute tolerance window). That logic is app-specific; the [`webhooks/inbound-receiver`](../inbound-receiver) recipe accepts a `replayWindow` option for the comparison.

### Slack (rotating signing secrets)

Slack sends one signature per request but supports two valid secrets during rotation. Verify against both:

```ts
const body = await request.text()
const valid = await verifyHmacSignature({
  payload: `v0:${timestamp}:${body}`,
  signature: request.headers.get('x-slack-signature') ?? '',
  secret: env.SLACK_SIGNING_SECRET_CURRENT,
  prefix: 'v0=',
})
const validFallback = valid
  ? true
  : await verifyHmacSignature({
      payload: `v0:${timestamp}:${body}`,
      signature: request.headers.get('x-slack-signature') ?? '',
      secret: env.SLACK_SIGNING_SECRET_PREVIOUS ?? '',
      prefix: 'v0=',
    })
```

### Non-SHA-256 algorithms

Some providers sign with SHA-384 or SHA-512:

```ts
const valid = await verifyHmacSignature({
  payload: body,
  signature: request.headers.get('x-signature-512') ?? '',
  secret: env.WEBHOOK_SECRET,
  algorithm: 'SHA-512',
})
```

### Generic (`X-Signature: <hex>`)

```ts
const valid = await verifyHmacSignature({
  payload: body,
  signature: request.headers.get('x-signature') ?? '',
  secret: env.WEBHOOK_SECRET,
})
```

## Required configuration

The secret is per-source. Store each as a separate Worker secret:

```bash
wrangler secret put GITHUB_WEBHOOK_SECRET
wrangler secret put STRIPE_WEBHOOK_SECRET
```

Add to a recipe-local `.d.ts` (or `env-webhooks.d.ts`) so TS sees them:

```ts
declare namespace Cloudflare {
  interface Env {
    GITHUB_WEBHOOK_SECRET?: string
    STRIPE_WEBHOOK_SECRET?: string
  }
}
```

## What this recipe does NOT handle

- **Reading the request body.** The helper accepts `string | ArrayBuffer`; the caller reads the body. Read once and reuse.
- **Replay protection by timestamp.** See `webhooks/inbound-receiver`'s `replayWindow` option.
- **Idempotency-key dedup.** Same recipe.
- **Non-HMAC schemes.** RSA-signed webhooks (Apple, some banking APIs) and Ed25519-signed webhooks (Discord) need different helpers.
- **The route itself.** The helper is a building block. For the full receiver, install [`webhooks/inbound-receiver`](../inbound-receiver).

## After install

1. Store each per-source secret via `wrangler secret put`.
2. Declare the secrets on `Cloudflare.Env`.
3. Call `verifyHmacSignature(...)` from your webhook route handler.
4. Return 401 on failure; proceed with body parsing on success.
