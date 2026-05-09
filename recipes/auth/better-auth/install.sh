#!/usr/bin/env bash
set -euo pipefail

echo "▶ Installing better-auth..."
pnpm add better-auth

echo ""
echo "▶ Manual steps remaining:"
echo ""
echo "  1. Add this line to src/lib/db/schema.ts:"
echo ""
echo "       export * from './schema-auth'"
echo ""
echo "  2. Set BETTER_AUTH_SECRET in .dev.vars (generate with"
echo "     'openssl rand -base64 32'):"
echo ""
echo "       BETTER_AUTH_SECRET=<your-32-byte-random>"
echo ""
echo "  3. Add per-provider env vars to .dev.vars for any social /"
echo "     enterprise OIDC providers you want active. See README.md."
echo ""
echo "  4. Generate and apply the auth tables migration:"
echo ""
echo "       pnpm db:generate"
echo "       pnpm db:migrate:local"
echo ""
