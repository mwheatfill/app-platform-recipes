# `background/workflow`

Wires a Cloudflare Workflow (durable multi-step execution) into `template-cf-fullstack`. Adds a `WorkflowEntrypoint` class example, the wrangler binding shape, and the call-site pattern for kicking off instances.

Use Workflows for work that must survive isolate restarts: sagas, long sleeps between steps, retry-with-state, human-in-the-loop approvals, multi-step AI pipelines. For fire-and-forget async work, use [`background/queue-consumer`](../queue-consumer). For periodic time-based fires, use [`background/cron-trigger`](../cron-trigger).

## Supported templates

`template-cf-fullstack`.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/lib/workflow/example-workflow.ts` | `ExampleWorkflow` class extending `WorkflowEntrypoint`. Demonstrates `step.do(name, callback)`, `step.sleep(name, duration)`, and the `retries: { limit, delay, backoff }` option. Rename and adapt per workflow you need. |

No npm dependencies; Workflows are a Workers platform primitive.

## Manual steps after install

### 1. Add the workflow binding to `wrangler.jsonc`

```jsonc
{
  "workflows": [
    {
      "name": "example-workflow",
      "binding": "EXAMPLE_WORKFLOW",
      "class_name": "ExampleWorkflow"
    }
  ]
}
```

`class_name` must match the exported class. `binding` is the env-binding name your app code uses. `name` is the dashboard-visible identifier.

After editing, regenerate the env types: `pnpm cf-typegen`.

### 2. Export the class from the Worker entry

Workflow classes must be exported from the Worker's entry module (the one `wrangler.jsonc` `main` points at). Add to `src/server.ts`:

```ts
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

export { ExampleWorkflow } from '@/lib/workflow/example-workflow'

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request)
  },
})
```

If [`monitoring/sentry`](../../monitoring/sentry) is installed, your default export is already `Sentry.withSentry(...)`. Re-export the Workflow class as a named export alongside the wrapped default; the two coexist. See the [`monitoring/sentry` README](../../monitoring/sentry/README.md) for the composed shape.

### 3. Trigger a workflow instance from app code

```ts
import { env } from 'cloudflare:workers'

const instance = await env.EXAMPLE_WORKFLOW.create({
  params: { jobId: 'abc-123' },
})

const status = await env.EXAMPLE_WORKFLOW.get(instance.id)
```

## Pattern

A Workflow is a class with one method (`run`) composed of `step.do` and `step.sleep` calls. Each `step.do` checkpoint is durable: if the isolate dies, the next attempt resumes from the last successful step rather than restarting.

Keep step callbacks small and idempotent. They may re-run on retry; `ctx.attempt` (1-indexed) is available inside the callback for logging or progressive-backoff logic.

Steps return JSON-serializable data; the engine persists what you return so the next step can use it.

## What this recipe does NOT handle

- **App-level orchestration logic.** The example workflow body is a stub. Each app composes its own steps.
- **Status UI.** Listing in-flight instances and surfacing their state to users is app work. Use `env.EXAMPLE_WORKFLOW.get(instanceId)` to read status.
- **Cancellation flows.** `instance.terminate()` is available; the policy for when to cancel is app-specific.
- **Cross-workflow coordination.** Workflows can spawn other workflows; designing the saga is your call.

## After install

1. Add `workflows[]` binding to `wrangler.jsonc` with matching `class_name`.
2. Regenerate types: `pnpm cf-typegen`.
3. Re-export the class from `src/server.ts` (creating one if not present).
4. Trigger an instance from app code via `env.EXAMPLE_WORKFLOW.create({ params: {...} })`.
5. Verify by inspecting the workflow's status in the Cloudflare dashboard or via `env.EXAMPLE_WORKFLOW.get(instanceId)`.
