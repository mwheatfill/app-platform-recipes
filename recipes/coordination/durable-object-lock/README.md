# `coordination/durable-object-lock`

Per-key mutual exclusion via a single-keyed Durable Object. Use when multiple Worker isolates may race to execute the same logical task and exactly one should win: scheduled-job evaluator dispatching the same schedule, deduplicating concurrent webhook-fanouts, single-leader sweeps.

Each lock key gets its own Durable Object instance. Acquire-check-write is atomic because the DO is single-threaded per instance; no explicit transactions needed. TTL is the safety net so a crashing holder doesn't permanently park the lock.

## Supported templates

`template-cf-fullstack`.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/lib/coordination/lock-durable-object.ts` | `LockDurableObject` class extending `DurableObject`. RPC methods: `acquire`, `release`, `status`. Exports `AcquireResult` + `LockStatus` types. |
| `src/lib/coordination/lock.ts` | `withLock(ns, key, opts, fn)` + `tryAcquireLock(ns, key, opts)` helpers. |

No npm dependencies; Durable Objects are a Workers platform primitive.

## Manual steps after install

### 1. Wrangler binding + migration

In `wrangler.jsonc`:

```jsonc
{
  "durable_objects": {
    "bindings": [
      { "name": "LOCKS", "class_name": "LockDurableObject" }
    ]
  },
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["LockDurableObject"] }
  ]
}
```

If you already have `migrations` entries, add a new entry with the next `tag` and the SQLite class name. SQLite-backed Durable Objects are Cloudflare's recommended storage backend for all new classes.

After editing, regenerate types: `pnpm cf-typegen`.

### 2. Re-export the class from the Worker entry

Durable Object classes must be exported from the Worker's entry module (the one `wrangler.jsonc` `main` points at). Add to `src/server.ts`:

```ts
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

export { LockDurableObject } from '@/lib/coordination/lock-durable-object'

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request)
  },
})
```

If [`monitoring/sentry`](../../monitoring/sentry) is installed, your default export is already `Sentry.withSentry(...)`. Re-export the class as a named export alongside the wrapped default; the two coexist. See the [`monitoring/sentry` README](../../monitoring/sentry/README.md) for the composed shape.

## Usage

### Acquire-run-release (preferred)

```ts
import { env } from 'cloudflare:workers'
import { withLock } from '@/lib/coordination/lock'

const result = await withLock(
  env.LOCKS,
  `schedule-${scheduleId}`,
  { ttlSeconds: 60 },
  async () => {
    return dispatchSchedule(scheduleId)
  },
)

if (result === null) {
  // Another isolate is dispatching this schedule; skip this fire.
}
```

`withLock` returns `null` when the lock was already held. On success, returns whatever the inner function returns. The lock is released in a `finally` block; if the inner function throws, the lock still releases.

### Manual acquire / release

For workflows that outlive the request (lock acquired by the scheduled handler, released by a queue consumer):

```ts
import { tryAcquireLock } from '@/lib/coordination/lock'

const result = await tryAcquireLock(env.LOCKS, `migration-${id}`, {
  ttlSeconds: 300,
  holder: `migrator-${crypto.randomUUID()}`,
})
if (result.acquired) {
  await env.MIGRATION_QUEUE.send({ id })
} else {
  // result.holder and result.expiresAt show who has it and until when
}

// Later, after the consumer finishes:
await env.LOCKS.getByName(`migration-${id}`).release()
```

`holder` is optional metadata for debugging. `acquire` returns the current holder + expiry on failure so the caller doesn't need a second RPC to learn who has the lock.

### Status query

```ts
const status = await env.LOCKS.getByName(`schedule-${scheduleId}`).status()
if (status.held) {
  // status.expiresAt: number, status.holder?: string
} else {
  // status.held === false; no expiresAt/holder fields
}
```

The discriminated union narrows on `held`, so TypeScript's strict mode lets you read `status.expiresAt` cleanly inside the `held: true` branch.

## Choosing a TTL

The lock auto-expires after `ttlSeconds` regardless of release. Set it to:

- **Expected work duration + buffer.** If the work takes ~10 seconds, set TTL to 30–60 seconds.
- **Bounded by your fire interval.** For an every-minute cron evaluator, TTL ≤ 60 seconds; otherwise a stuck holder blocks the next valid fire.
- **Long enough that retry-after-failure works.** If the work takes 2 minutes and you set TTL to 30 seconds, the lock expires mid-work and a duplicate caller acquires.

For work that genuinely runs longer than any sensible TTL, split it: acquire the lock, kick off a Workflow that owns the durable state, release. The Workflow handles its own concurrency via its instance ID.

## Caveats

- **TTL is the only safety net.** If your code holds a stub reference and crashes without calling `release()`, the lock parks until TTL expiry. Set realistic TTLs.
- **Cold-start latency on first acquire.** A DO that's been evicted incurs a few hundred ms to spin up. Repeated calls to the same lock key reuse the warm instance; an evaluator firing every minute against the same schedule keys stays warm.
- **`getByName` is a 2025 platform API.** Requires a workerd build from August 2025 or later. The template's pinned compatibility date covers this; if you've manually downgraded, switch to `idFromName` + `get`.
- **Don't use one global lock.** Single-DO-for-everything is the documented anti-pattern; throughput collapses. Per-key sharding (`schedule-<id>`, `tenant-<id>`) is the design.
- **Concurrent lock attempts inside the same DO are serialized.** That's the point. If many isolates ask for the same key in tight succession, throughput on that key is bounded by the DO's per-instance request rate.
- **No re-entrancy.** A holder can't re-acquire its own lock; the second `acquire` returns `{ acquired: false, ... }`. Either pass the lock state down through the call stack, or refactor to acquire once at the top. The `holder` field is diagnostic; the recipe deliberately doesn't allow same-holder refresh to keep the contract simple.

## Pattern

`withLock` is the default; manual `tryAcquireLock` + direct `stub.release()` is for cross-invocation workflows. Both compose with [`background/cron-trigger`](../../background/cron-trigger) (evaluator) and [`background/queue-consumer`](../../background/queue-consumer) (work that outlives the request). The holder metadata is a diagnostic, not a security boundary; anyone with the namespace binding can release any key.

## After install

1. Add `durable_objects.bindings` + `migrations.new_sqlite_classes` to `wrangler.jsonc`; `pnpm cf-typegen`.
2. Re-export `LockDurableObject` from `src/server.ts` (creating one if not present).
3. Use `withLock(env.LOCKS, ...)` from app code.
4. Verify by triggering two near-simultaneous attempts and confirming only one wins.
