import * as Sentry from '@sentry/react'
import type { AnyRouter } from '@tanstack/react-router'

export function initSentryClient(router: AnyRouter): void {
  if (router.isServer) return
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_PUBLIC_ENV ?? 'unknown',
    sendDefaultPii: true,
    integrations: [
      Sentry.tanstackRouterBrowserTracingIntegration(router),
      Sentry.replayIntegration(),
    ],
    enableLogs: true,
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}
