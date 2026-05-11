#!/usr/bin/env bash
set -euo pipefail

echo "▶ Installing Sentry SDKs and Vite plugin..."
pnpm add @sentry/cloudflare @sentry/react
pnpm add -D @sentry/vite-plugin

echo ""
echo "▶ Manual steps remaining (see recipe README for full snippets):"
echo "  - wrangler.jsonc: set 'main' to './src/server.ts'"
echo "  - src/router.tsx: call initSentryClient(router) inside getRouter"
echo "  - vite.config.ts: add sentryVitePlugin (last plugin), build.sourcemap: 'hidden'"
echo "  - .dev.vars: SENTRY_DSN (+ VITE_SENTRY_DSN for browser, optional SENTRY_RELEASE)"
echo "  - GitHub Secrets: SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT"
echo ""
