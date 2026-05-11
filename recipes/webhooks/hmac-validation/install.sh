#!/usr/bin/env bash
set -euo pipefail

echo "▶ No npm dependencies; HMAC verification uses Workers' Web Crypto API."
echo ""
echo "▶ Manual steps (see recipe README for the per-provider snippets):"
echo "  - Store the shared secret as a per-source Worker secret"
echo "    (e.g. wrangler secret put GITHUB_WEBHOOK_SECRET)"
echo "  - Add Cloudflare.Env declarations for the secrets you wire"
echo ""
