# `webhooks/hmac-validation`

HMAC-SHA256 signature verification for inbound webhooks. Single helper, no dependencies, uses Workers' Web Crypto API. The pair recipe [`webhooks/inbound-receiver`](../inbound-receiver) builds on top of this for the full "receive → validate → enqueue → archive" pattern.

Use when you're accepting webhooks from a provider that signs payloads with HMAC-SHA256: GitHub, Stripe, Slack, GitLab, Cloudflare itself, most CI providers, most payment providers. For non-HMAC signature schemes (RSA, Ed25519) you'll need a different recipe.

## Supported templates

`template-cf-fullstack`.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/lib/webhooks/hmac.ts` | `verifyHmacSignature({ payload, signature, secret, prefix? })` returns a `Promise<boolean>`. Uses `crypto.subtle.verify` (timing-safe). |

No npm dependencies; Web Crypto is built into Workers.

## How it works

Web Crypto's `crypto.subtle.verify` performs constant-time comparison internally. The helper:

1. Strips an optional `prefix` from the signature (`sha256=` for GitHub, `v1=` for Stripe, etc.).
2. Hex-decodes the remaining signature to bytes.
3. Imports the secret as an HMAC-SHA256 key.
4. Calls `crypto.subtle.verify('HMAC', key, sigBytes, payloadBytes)`.

Returns `false` on any decode failure rather than throwing, so route handlers branch on a single boolean. Imported CryptoKeys are cached per-secret at module scope so repeat verifications skip the `importKey` round-trip.

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

### Stripe (`Stripe-Signature: t=<ts>,v1=<hex>`)

Stripe signs `<timestamp>.<body>`, not the body alone. The Stripe header can also carry multiple `v1=` entries during a secret rotation; the example below covers the single-signature case only. Parse the header first:

```ts
const header = request.headers.get('stripe-signature') ?? ''
const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]))
const timestamp = parts.t
const signature = parts.v1
const body = await request.text()
const valid = await verifyHmacSignature({
  payload: `${timestamp}.${body}`,
  signature,
  secret: env.STRIPE_WEBHOOK_SECRET ?? '',
})
```

Also reject stale timestamps to prevent replay attacks (Stripe recommends a 5-minute tolerance window). That logic is app-specific and not part of the recipe.

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

- **Reading the request body.** The helper accepts `string | ArrayBuffer`; the caller reads the body. Reading once and reusing is important — most webhooks need both the body for signature verification and the parsed body for processing.
- **Replay protection.** Timestamp tolerance windows (Stripe, Slack) are app-specific. Validate the timestamp claim in the header before passing to `verifyHmacSignature`.
- **Non-HMAC schemes.** RSA-signed webhooks (Apple, some banking APIs) and Ed25519-signed webhooks (Discord) need different helpers.
- **The route itself.** The helper is a building block. For a full receiver that validates + enqueues + archives, install [`webhooks/inbound-receiver`](../inbound-receiver).

## After install

1. Store each per-source secret via `wrangler secret put`.
2. Declare the secrets on `Cloudflare.Env`.
3. Call `verifyHmacSignature(...)` from your webhook route handler.
4. Return 401 on failure; proceed with body parsing on success.
