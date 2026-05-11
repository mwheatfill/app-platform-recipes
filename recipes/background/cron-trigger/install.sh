#!/usr/bin/env bash
set -euo pipefail

echo "▶ No npm dependencies; Cron Triggers are a Workers platform primitive."
echo ""
echo "▶ Manual steps remaining (see recipe README for snippets):"
echo "  - wrangler.jsonc: add triggers.crons array"
echo "  - src/server.ts: import handleScheduled from @/lib/scheduled/handler"
echo "                   and expose it as the scheduled export"
echo ""
echo "▶ Test locally with: pnpm exec wrangler dev --test-scheduled"
echo "   then: curl 'http://localhost:3000/cdn-cgi/handler/scheduled?cron=*+*+*+*+*'"
echo ""
