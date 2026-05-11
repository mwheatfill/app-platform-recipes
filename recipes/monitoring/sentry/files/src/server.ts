import * as Sentry from '@sentry/cloudflare'
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

const STATIC_OPTS = {
  sendDefaultPii: true,
  enableLogs: true,
  tracesSampleRate: 1.0,
} as const

// `env` arrives via the withSentry closure (Sentry SDK contract); other
// recipes read it via `import { env } from 'cloudflare:workers'`.
export default Sentry.withSentry(
  (env: Cloudflare.Env) => ({
    ...STATIC_OPTS,
    dsn: env.SENTRY_DSN ?? '',
    environment: env.PUBLIC_ENV ?? 'unknown',
    ...(env.SENTRY_RELEASE !== undefined ? { release: env.SENTRY_RELEASE } : {}),
  }),
  createServerEntry({
    fetch(request) {
      return handler.fetch(request)
    },
  }),
)
