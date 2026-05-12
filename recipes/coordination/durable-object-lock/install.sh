#!/usr/bin/env bash
set -euo pipefail

echo "▶ No npm dependencies; Durable Objects are a Workers platform primitive."
echo ""
echo "▶ Manual steps (see recipe README for snippets):"
echo "  - wrangler.jsonc: add durable_objects.bindings + migrations.new_sqlite_classes"
echo "  - src/server.ts: re-export LockDurableObject alongside the default handler"
echo "  - pnpm cf-typegen after wrangler edits"
echo ""
