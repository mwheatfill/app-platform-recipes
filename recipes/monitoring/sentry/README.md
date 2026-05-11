# `monitoring/sentry`

Wires Sentry error + performance monitoring for `template-cf-fullstack`. Worker side via `@sentry/cloudflare`, browser side via `@sentry/react`, source-map upload via `@sentry/vite-plugin` at build time.

App code keeps calling `logInfo` / `logWarn` / `logError` from `@/lib/log` unchanged. Sentry's `enableLogs: true` mirrors `console.*` output (which the log wrapper emits) into Sentry's Logs product. No `log.ts` overlay needed.

## Supported templates

`template-cf-fullstack`.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/server.ts` | Worker entry wrapping `createServerEntry(...)` with `Sentry.withSentry`. Replaces the framework default at `@tanstack/react-start/server-entry`. |
| `src/lib/monitoring/sentry-client.ts` | `initSentryClient(router)` for the browser SDK init. |
| `src/env-sentry.d.ts` | Augments `Cloudflare.Env` with `SENTRY_DSN`, `SENTRY_RELEASE`. |

Deps added: `@sentry/cloudflare`, `@sentry/react` (runtime); `@sentry/vite-plugin` (dev).

## Why not `@sentry/tanstackstart-react`

That package ships `workerd` / `worker` export conditions that resolve to `@sentry/node`, which doesn't run on Cloudflare's runtime. Tracked as [getsentry/sentry-javascript#20038](https://github.com/getsentry/sentry-javascript/issues/20038). This recipe uses `@sentry/cloudflare` directly for the worker and `@sentry/react` directly for the browser, which is the documented workaround.

## Manual steps after install

These edits touch template-owned files; the recipe documents them rather than overwriting your wiring.

### 1. Repoint the worker entry

In `wrangler.jsonc`:

```jsonc
{
  "main": "./src/server.ts"
}
```

Was `"@tanstack/react-start/server-entry"`. The recipe-shipped `src/server.ts` re-imports and wraps that framework entry, so behavior is identical aside from Sentry instrumentation.

### 2. Initialize Sentry in the browser

In `src/router.tsx`, inside `getRouter`, after `createRouter`, before `setupRouterSsrQueryIntegration`:

```tsx
import { initSentryClient } from '@/lib/monitoring/sentry-client'

export function getRouter() {
  const queryClient = createQueryClient()
  const router = createRouter({ /* ... */ })

  initSentryClient(router)
  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}
```

`initSentryClient` is a no-op on the server (it checks `router.isServer`).

### 3. Wire source-map upload

In `vite.config.ts`:

```ts
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  // ...existing config...
  plugins: [
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    viteReact(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        filesToDeleteAfterUpload: ['./dist/**/*.map'],
      },
    }),
  ],
  build: {
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 750,
  },
})
```

The plugin must come **last** (per Sentry's docs) so it sees the final bundle. `sourcemap: 'hidden'` generates maps for upload without exposing them in the bundle.

## Required configuration

### App env vars (`.dev.vars` locally, `wrangler secret` in prod)

| Var | Required | Purpose |
| --- | --- | --- |
| `SENTRY_DSN` | yes | Identifies the Sentry project. Format: `https://<key>@<org>.ingest.sentry.io/<project>`. |
| `SENTRY_RELEASE` | recommended | Release identifier (typically the git SHA). Matched against source-map upload so traces deobfuscate. |

### Client-visible env (Vite-prefixed)

The browser SDK reads `import.meta.env.VITE_SENTRY_DSN`. Set in `.dev.vars` or as a Worker `var` in `wrangler.jsonc` (TanStack Start surfaces `VITE_*` to the client at build time).

```
VITE_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
VITE_PUBLIC_ENV=dev
```

`VITE_SENTRY_DSN` can equal `SENTRY_DSN`. The split exists only because Vite's client-bundle exposure rule requires the `VITE_` prefix.

### CI (GitHub Secrets)

Add at **Settings → Secrets and variables → Actions** before the next push:

| Secret | Purpose |
| --- | --- |
| `SENTRY_AUTH_TOKEN` | Sentry user or internal-integration token with project:write scope. Used by the Vite plugin during build. |
| `SENTRY_ORG` | Your Sentry org slug. |
| `SENTRY_PROJECT` | Your Sentry project slug. |

Pass them to the `pnpm build` step in `.github/workflows/main.yml` and `.github/workflows/deploy-production.yml`:

```yaml
- name: Type check + build
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
    SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
  run: pnpm build
```

The plugin no-ops when `SENTRY_AUTH_TOKEN` is unset, so local builds still work without it.

## What this recipe does NOT handle

- **The Sentry project itself.** Create it in the Sentry dashboard before installing.
- **Custom integrations.** Profiling, custom transports, replay masking — extend `src/server.ts` and `sentry-client.ts` per the [Sentry config options docs](https://docs.sentry.io/platforms/javascript/guides/cloudflare/configuration/options/).
- **PII redaction.** `sendDefaultPii: true` is on by default; tune via [`beforeSend`](https://docs.sentry.io/platforms/javascript/configuration/filtering/) if your app handles regulated data.
- **Alerting + dashboards.** Configured in Sentry's UI, not in code.

## Pattern

App code calls `logInfo` / `logWarn` / `logError` from `@/lib/log` and uncaught exceptions are captured automatically. Direct `import * as Sentry from '@sentry/cloudflare'` outside `src/server.ts` and `src/lib/monitoring/` is a smell; if you need explicit capture (with tags, fingerprint, etc.), add a helper to `src/lib/monitoring/` rather than scattering Sentry imports through app code.

## After install

1. Copy `src/server.ts` into the app and confirm `wrangler.jsonc` points at it.
2. Add `initSentryClient(router)` in `src/router.tsx`.
3. Add `sentryVitePlugin` to `vite.config.ts` with `sourcemap: 'hidden'`.
4. Set `SENTRY_DSN` (+ optional `SENTRY_RELEASE`) in `.dev.vars`; `VITE_SENTRY_DSN` matches.
5. Add CI secrets `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
6. Trigger an error in dev (e.g. throw inside a server fn); confirm it lands in Sentry.
