// Augments Cloudflare.Env with the env vars consumed by the
// auth/cloudflare-access recipe. Auto-picked-up by tsconfig.

declare namespace Cloudflare {
  interface Env {
    // Cloudflare Access team domain, e.g. https://<team>.cloudflareaccess.com
    TEAM_DOMAIN?: string
    // Application Audience (AUD) tag from the Access application
    POLICY_AUD?: string
    // JSON-serialized User for local dev when CF Access isn't in front.
    // Example: {"id":"dev","email":"me@example.com","groups":["App-Admins"]}
    DEV_AUTH_BYPASS_USER?: string
  }
}
