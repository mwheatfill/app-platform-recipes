declare namespace Cloudflare {
  interface Env {
    TEAM_DOMAIN?: string
    POLICY_AUD?: string
    // JSON-serialized User for local dev when CF Access isn't in front.
    // Example: {"id":"dev","email":"me@example.com","groups":["App-Admins"]}
    DEV_AUTH_BYPASS_USER?: string
  }
}
