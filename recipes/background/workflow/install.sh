#!/usr/bin/env bash
set -euo pipefail

echo "▶ No npm dependencies; Workflows are a Workers platform primitive."
echo ""
echo "▶ Manual steps remaining (see recipe README for snippets):"
echo "  - wrangler.jsonc: add workflows[] binding"
echo "  - src/server.ts: export the Workflow class alongside the default handler"
echo "  - pnpm cf-typegen after wrangler.jsonc edits"
echo "  - Trigger from app code: env.MY_WORKFLOW.create({ params: {...} })"
echo ""
