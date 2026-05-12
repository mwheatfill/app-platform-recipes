import * as Sentry from '@sentry/cloudflare'
import handler from '@tanstack/react-start/server-entry'

const STATIC_OPTS = {
  sendDefaultPii: true,
  enableLogs: true,
  tracesSampleRate: 1.0,
} as const

// Plain ExportedHandler shape, not createServerEntry: TanStack's RequestHandler signature is not assignable to withSentry's ExportedHandler<Env> slot.
export default Sentry.withSentry(
  (env: Cloudflare.Env) => ({
    ...STATIC_OPTS,
    dsn: env.SENTRY_DSN ?? '',
    environment: env.PUBLIC_ENV ?? 'unknown',
    ...(env.SENTRY_RELEASE !== undefined ? { release: env.SENTRY_RELEASE } : {}),
  }),
  {
    fetch(request: Request): Response | Promise<Response> {
      return handler.fetch(request)
    },
  } satisfies ExportedHandler<Cloudflare.Env>,
)
