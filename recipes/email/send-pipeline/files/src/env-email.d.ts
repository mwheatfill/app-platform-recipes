// Augments Cloudflare.Env with the env vars consumed by the
// email/send-pipeline recipe. Auto-picked-up by tsconfig include.

declare namespace Cloudflare {
  interface Env {
    EMAIL_TRANSPORT?: 'resend' | 'graph' | 'cloudflare-email'
  }
}
