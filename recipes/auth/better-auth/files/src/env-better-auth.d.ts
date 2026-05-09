// Augments Cloudflare.Env with the env vars consumed by the
// auth/better-auth recipe. Auto-picked-up by tsconfig include.

declare namespace Cloudflare {
  interface Env {
    BETTER_AUTH_SECRET?: string
    BETTER_AUTH_URL?: string

    // Social OAuth (each provider activates when its CLIENT_ID + CLIENT_SECRET are set)
    GOOGLE_CLIENT_ID?: string
    GOOGLE_CLIENT_SECRET?: string
    GITHUB_CLIENT_ID?: string
    GITHUB_CLIENT_SECRET?: string
    APPLE_CLIENT_ID?: string
    APPLE_CLIENT_SECRET?: string

    // Microsoft Entra OIDC (TENANT_ID optional for tenant-scoped flows)
    MICROSOFT_CLIENT_ID?: string
    MICROSOFT_CLIENT_SECRET?: string
    MICROSOFT_TENANT_ID?: string
  }
}
