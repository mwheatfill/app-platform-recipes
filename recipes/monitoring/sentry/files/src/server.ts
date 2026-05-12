import * as Sentry from '@sentry/cloudflare'
import handler from '@tanstack/react-start/server-entry'

// Plain ExportedHandler shape, not createServerEntry: TanStack's RequestHandler signature is not assignable to withSentry's ExportedHandler<Env> slot.
export default Sentry.withSentry(
  (env: Cloudflare.Env) => ({
    sendDefaultPii: true,
    enableLogs: true,
    tracesSampleRate: 1.0,
    dsn: env.SENTRY_DSN ?? '',
    environment: env.PUBLIC_ENV ?? 'unknown',
    release: env.SENTRY_RELEASE,
  }),
  {
    fetch(request) {
      return handler.fetch(request)
    },
  } satisfies ExportedHandler<Cloudflare.Env>,
)
