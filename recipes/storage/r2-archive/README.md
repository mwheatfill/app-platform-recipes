# `storage/r2-archive`

Typed helpers over Cloudflare R2 for the "write a blob, read it back, optionally list" pattern: webhook raw bodies, response bodies from outbound HTTP, archived run history, any opaque payload that's too big for D1 or KV.

Composes with [`webhooks/inbound-receiver`](../../webhooks/inbound-receiver) (which writes raw webhook bodies to R2 at the same key shape `composeArchiveKey` produces) and [`background/queue-consumer`](../../background/queue-consumer) (consumers fetch archives by key from the queued message).

Use for blobs from a few KB to a few MB. For files larger than 100 MB use R2's multipart upload directly via the binding (the helpers wrap single-shot `put` only). For pure reads of arbitrary size, use `bucket.get(key)` directly to stream.

## Supported templates

`template-cf-fullstack`.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/lib/storage/r2-archive.ts` | `composeArchiveKey`, `putArchive`, `getArchiveText`, `listArchive`, `iterateArchive`. |

No npm dependencies; R2 is a Workers platform primitive.

## API

### `composeArchiveKey({ prefix, source, receivedAt?, id? }): string`

Date-prefixed, UUID-suffixed key. Format: `<prefix>/<source>/<receivedAt>-<uuid>`. Same shape that [`webhooks/inbound-receiver`](../../webhooks/inbound-receiver) writes (the two recipes don't share code; they share a documented format so list/iterate against the same prefix returns both directly-archived blobs and webhook bodies uniformly).

### `putArchive(bucket, key, body, options?)`

Wraps `R2Bucket.put` with typed `contentType` + `metadata: Record<string, string>` options. Body accepts everything `R2Bucket.put` accepts.

### `getArchiveText(bucket, key, options?) → { text, metadata, uploaded, size } | null`

Convenience for the common case: reads the body as text, surfaces custom metadata, upload timestamp, and size. Pass `maxBytes` to reject objects above a size threshold before reading the body (prevents memory blow-up; Workers have a 128 MB ceiling).

For streaming large objects without buffering, call `bucket.get(key)` directly and consume `object.body` as a `ReadableStream`.

### `listArchive(bucket, prefix, options?)` / `iterateArchive(bucket, prefix, options?)`

Pagination over R2's `list` API. `listArchive` returns one page with `{ objects, cursor?, truncated }`. `iterateArchive` is an async generator that handles the cursor loop internally. Both accept `limit?` and `includeMetadata?` (default `false`).

Per R2 docs: including metadata caps the page below `limit`, so default-off keeps full-throughput listing for the common case where callers only want keys + sizes. Set `includeMetadata: true` when you'll actually read `customMetadata` per object. Never use `objects.length` as a pagination signal; use `truncated`.

```ts
import { iterateArchive } from '@/lib/storage/r2-archive'

for await (const obj of iterateArchive(env.ARCHIVE, 'webhooks/github', { includeMetadata: true })) {
  // obj.key, obj.size, obj.uploaded, obj.customMetadata
}
```

### Delete

The recipe doesn't wrap `bucket.delete` because there's nothing to add over the binding. Call `env.ARCHIVE.delete(key)` directly. For batch deletes pass an array of keys.

## Usage

### Write + read a response body

```ts
import { env } from 'cloudflare:workers'
import {
  composeArchiveKey,
  getArchiveText,
  putArchive,
} from '@/lib/storage/r2-archive'

const upstream = await fetch('https://api.example.com/data')
const body = await upstream.text()
const key = composeArchiveKey({ prefix: 'responses', source: 'example-api' })
await putArchive(env.ARCHIVE, key, body, {
  contentType: upstream.headers.get('content-type') ?? 'application/json',
  metadata: { status: String(upstream.status), jobId: '123' },
})

// Later, in a consumer:
const archive = await getArchiveText(env.ARCHIVE, key, { maxBytes: 5_000_000 })
if (archive) {
  console.log(archive.text, archive.metadata.jobId)
}
```

### Pair with `webhooks/inbound-receiver`

The receiver writes archives at `${archive.prefix}/${source}/${receivedAt}-${uuid}` and forwards the key in the queued message. The consumer fetches the body via the binding directly (streaming) or via the helper (buffered text):

```ts
async function processWebhook(message: Message<InboundWebhookMessage>, env: Cloudflare.Env) {
  if (!message.body.archiveKey) {
    return processBody(message.body.body)
  }
  const object = await env.ARCHIVE.get(message.body.archiveKey)
  if (!object) {
    throw new Error(`Archive missing: ${message.body.archiveKey}`)
  }
  return processBody(await object.text())
}
```

### Run-history listing

```ts
import { listArchive } from '@/lib/storage/r2-archive'

const page = await listArchive(env.ARCHIVE, `runs/${scheduleId}`, {
  limit: 50,
  includeMetadata: true,
})
for (const obj of page.objects) {
  // obj.key, obj.size, obj.uploaded, obj.customMetadata.status
}
if (page.truncated) {
  // Pass page.cursor to the next call
}
```

## Wrangler binding

```jsonc
{
  "r2_buckets": [
    { "binding": "ARCHIVE", "bucket_name": "app-archive" }
  ]
}
```

Create the bucket via `wrangler r2 bucket create app-archive`. Regenerate types after editing: `pnpm cf-typegen`.

## Object lifecycle

R2 buckets have lifecycle rules configured at the bucket level (not in `wrangler.jsonc`). To auto-expire old archives:

```bash
pnpm exec wrangler r2 bucket lifecycle add app-archive --expire-days 30
```

Lifecycle rules support prefix filters, so different retention per concern is possible:

```bash
# Webhook bodies retained 7 days
pnpm exec wrangler r2 bucket lifecycle add app-archive --expire-days 7 --prefix webhooks/
# Run history retained 90 days
pnpm exec wrangler r2 bucket lifecycle add app-archive --expire-days 90 --prefix runs/
```

Per the R2 docs: object deletion typically completes within 24 hours of the `x-amz-expiration` value. Existing objects may take longer to transition when a rule changes.

## What this recipe does NOT handle

- **Files > 100 MB.** Single-shot `put` works up to R2's per-put limit. For multipart uploads, use `bucket.createMultipartUpload(key)` directly.
- **Public access.** R2 objects are private by default. To serve publicly, configure a [public bucket](https://developers.cloudflare.com/r2/buckets/public-buckets/) or signed URLs at the bucket level.
- **CORS.** Configure on the bucket directly if browser-side access is needed.
- **Conditional operations.** `R2GetOptions.onlyIf` (etag-based) and `R2PutOptions.onlyIf` (optimistic concurrency) are not surfaced; call the binding directly when needed.
- **Range reads.** Same as above; call the binding directly when needed.

## Pattern

The helpers wrap R2 only where they add real type-narrowing or default behavior: `composeArchiveKey` enforces the shape, `putArchive` types metadata as `Record<string, string>`, `listArchive`/`iterateArchive` reshape pagination output and gate the metadata-include trade-off. Pure pass-throughs (`get`, `delete`) call the binding directly.

## After install

1. Create the R2 bucket(s) via `wrangler r2 bucket create`.
2. Add the `r2_buckets` binding to `wrangler.jsonc`; `pnpm cf-typegen`.
3. Configure lifecycle rules per prefix to match your retention policy.
4. Verify by writing + reading a test blob through the helpers.
