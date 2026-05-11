declare namespace Cloudflare {
  interface Env {
    SENTRY_DSN?: string
    SENTRY_RELEASE?: string
  }
}

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_PUBLIC_ENV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
