#!/usr/bin/env bash
set -euo pipefail

echo "▶ No npm dependencies; R2 is a Workers platform primitive."
echo ""
echo "▶ Manual steps (see recipe README for snippets):"
echo "  - Create the bucket: pnpm exec wrangler r2 bucket create <bucket-name>"
echo "  - wrangler.jsonc: add r2_buckets binding"
echo "  - (Optional) configure object lifecycle:"
echo "      pnpm exec wrangler r2 bucket lifecycle add <bucket-name> --expire-days <N>"
echo "  - pnpm cf-typegen after wrangler edits"
echo ""
