#!/usr/bin/env bash
set -euo pipefail

echo "▶ No npm dependencies; uses Web Crypto + Cloudflare Queues + R2 bindings."
echo ""
echo "▶ Prerequisites:"
echo "  - webhooks/hmac-validation must be installed (compatibility.json requires it)"
echo ""
echo "▶ Manual steps (see recipe README for snippets):"
echo "  - Create a TanStack Start API route per source (e.g. src/routes/api/webhooks/\$source.ts)"
echo "  - (Optional) Bind a queue per wrangler.jsonc + install background/queue-consumer"
echo "    so app code consumes the dispatched messages"
echo "  - (Optional) Bind an R2 bucket per wrangler.jsonc for durable raw-body archive"
echo "  - Store each per-source webhook secret via wrangler secret put"
echo ""
