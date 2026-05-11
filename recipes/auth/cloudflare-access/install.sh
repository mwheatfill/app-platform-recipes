#!/usr/bin/env bash
set -euo pipefail

echo "▶ Installing jose for JWT validation..."
pnpm add jose

echo ""
echo "▶ Manual steps remaining:"
echo ""
echo "  1. Create a self-hosted Cloudflare Access application for your"
echo "     app's domain (Zero Trust > Access controls > Applications)."
echo "     Add an Allow policy bound to your identity provider."
echo ""
echo "  2. Copy the Application Audience (AUD) Tag from the application's"
echo "     Additional settings. Add to .dev.vars (and 'wrangler secret put"
echo "     POLICY_AUD' for deployed envs):"
echo ""
echo "       TEAM_DOMAIN=https://<your-team>.cloudflareaccess.com"
echo "       POLICY_AUD=<your-application-aud-tag>"
echo ""
echo "  3. For local dev (no CF Access in front), set DEV_AUTH_BYPASS_USER"
echo "     to a JSON-serialized User in .dev.vars:"
echo ""
echo '       DEV_AUTH_BYPASS_USER={"id":"dev","email":"me@example.com","groups":["App-Admins"]}'
echo ""
echo "  4. Map your IdP group claims through Cloudflare Access to a"
echo "     'groups' claim on the JWT (or edit src/lib/auth/cloudflare-"
echo "     access-provider.ts to read whatever claim name your setup uses)."
echo ""
