# `background/cron-trigger`

Wires a Cloudflare Cron Trigger into `template-cf-fullstack`. Adds a `scheduled()` handler to the Worker and the `triggers.crons` config to `wrangler.jsonc`.

Use this for any time-based work the Worker should run on a fixed schedule: periodic snapshots, retry sweeps, evaluator loops, rotating tokens. For multi-step durable work after a fire, pair with [`background/workflow`](../workflow). For fan-out async work, pair with [`background/queue-consumer`](../queue-consumer).

## Supported templates

`template-cf-fullstack`.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/lib/scheduled/handler.ts` | `handleScheduled(controller, env, ctx)` function. Logs the fire and stubs the body for your logic. |

No npm dependencies; Cron Triggers are a Workers platform primitive.

## Manual steps after install

### 1. Add the cron expression to `wrangler.jsonc`

```jsonc
{
  "triggers": {
    "crons": ["* * * * *"]
  }
}
```

For per-environment schedules (e.g. only run nightly cleanup in production):

```jsonc
{
  "env": {
    "production": {
      "triggers": {
        "crons": ["0 3 * * *"]
      }
    }
  }
}
```

### 2. Expose the `scheduled` export from the Worker entry

If you've installed [`monitoring/sentry`](../../monitoring/sentry), the entry is already `src/server.ts`. Otherwise, create one and repoint `wrangler.jsonc` `main` at it.

```ts
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { handleScheduled } from '@/lib/scheduled/handler'

export default {
  ...createServerEntry({
    fetch(request) {
      return handler.fetch(request)
    },
  }),
  scheduled: handleScheduled,
}
```

If [`monitoring/sentry`](../../monitoring/sentry) is installed, your default export is already `Sentry.withSentry(...)`. Attach `scheduled` to the wrapped default with object spread; see the [`monitoring/sentry` README](../../monitoring/sentry/README.md) for the composed shape.

### 3. Test locally

```bash
pnpm exec wrangler dev --test-scheduled
curl "http://localhost:3000/cdn-cgi/handler/scheduled?cron=*+*+*+*+*"
```

The `cron` query string must match a configured cron expression character-for-character.

## Multiple cron expressions

One Worker can register many cron expressions. They all invoke the same `scheduled()`; use `controller.cron` to branch:

```ts
import { logInfo } from '@/lib/log'

export async function handleScheduled(controller: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
  switch (controller.cron) {
    case '* * * * *':
      ctx.waitUntil(evaluatePendingJobs(env))
      break
    case '0 3 * * *':
      ctx.waitUntil(nightlyCleanup(env))
      break
  }
}
```

The expression in the switch case must match `wrangler.jsonc` exactly, including spacing.

## What this recipe does NOT handle

- **App-supplied cron expressions.** If users define their own cron strings (e.g. a scheduler app), the parsing happens in app code with a library like `croner` or `cron-parser`. The Workers Cron Trigger fires the Worker itself on a fixed schedule.
- **Long-running work.** A `scheduled()` invocation has a CPU-time budget like any Worker request. For durable multi-step jobs (sleep, retry, wait for external event), enqueue work onto Queues or kick off a Workflow from inside `scheduled()`.

## Pattern

`scheduled()` is the trigger. Real work happens elsewhere (D1 writes, Queue sends, Workflow creates). Keep the handler thin: log, branch on `controller.cron`, dispatch via `ctx.waitUntil(...)`.

## After install

1. Add `triggers.crons` to `wrangler.jsonc`.
2. Add the `scheduled` export to `src/server.ts` (creating one if not present).
3. Verify locally: `pnpm exec wrangler dev --test-scheduled` + `curl 'http://localhost:3000/cdn-cgi/handler/scheduled?cron=...'`.
4. Deploy and watch logs to confirm the fire lands at the expected cadence (cron changes can take up to 15 minutes to propagate).
