#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f pnpm-workspace.yaml ]] || ! grep -q "^allowBuilds:" pnpm-workspace.yaml; then
  echo "✗ pnpm-workspace.yaml with an 'allowBuilds:' key not found. This recipe expects the template's workspace file."
  exit 1
fi

if ! grep -q "'@sentry/cli':" pnpm-workspace.yaml; then
  echo "▶ Allowing @sentry/cli build scripts in pnpm-workspace.yaml..."
  awk "/^allowBuilds:/ { print; print \"  '@sentry/cli': true\"; next } { print }" \
    pnpm-workspace.yaml > pnpm-workspace.yaml.tmp \
    && mv pnpm-workspace.yaml.tmp pnpm-workspace.yaml
fi

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
