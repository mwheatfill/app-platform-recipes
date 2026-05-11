#!/usr/bin/env bash
set -euo pipefail

echo "▶ No npm dependencies; Cloudflare Queues are a Workers platform primitive."
echo ""
echo "▶ Manual steps remaining (see recipe README for snippets):"
echo "  - Create the queue: pnpm exec wrangler queues create <queue-name>"
echo "  - wrangler.jsonc: add queues.producers and queues.consumers bindings"
echo "  - src/server.ts: import consumeQueueBatch and expose 'queue' export"
echo "  - (optional) create a dead-letter queue and reference it in consumer config"
echo ""
