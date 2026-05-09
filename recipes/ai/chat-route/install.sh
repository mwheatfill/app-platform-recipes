#!/usr/bin/env bash
set -euo pipefail

# Self-check: ai/chat-route imports from @/lib/ai/client which is provided
# by the AI provider recipe. Guard against being installed in the wrong
# order. The composer (M8) enforces dependency ordering automatically;
# manual installers see this message.

if [[ ! -f "src/lib/ai/client.ts" ]]; then
  echo "✗ src/lib/ai/client.ts not found." >&2
  echo "" >&2
  echo "  Install an AI provider recipe first:" >&2
  echo "    microsoft-foundry/chat-completion (default)" >&2
  echo "    cloudflare-workers-ai/setup" >&2
  echo "    anthropic/chat-completion" >&2
  echo "    openai/chat-completion" >&2
  echo "" >&2
  echo "  Then re-run this install." >&2
  exit 1
fi

# Self-check: ai/chat-route requires an auth provider (returns 401 if no
# session). Without an auth recipe installed, getCurrentUser returns null
# and every chat request 401s. That's correct behavior, but warn so the
# developer knows what's expected.

if grep -q "return null" src/lib/auth/get-current-user.ts 2>/dev/null; then
  echo "⚠ src/lib/auth/get-current-user.ts looks like the template stub" >&2
  echo "  (returns null). This recipe ships an auth-protected handler;" >&2
  echo "  every request to /api/chat will return 401 until you install" >&2
  echo "  an auth recipe (auth/better-auth or auth/cloudflare-access)." >&2
  echo "" >&2
fi

echo "▶ Installing ai + AI SDK core..."
pnpm add ai

echo ""
echo "▶ Manual steps remaining:"
echo ""
echo "  1. Install ai/chat-ui to mount the chat surface."
echo ""
echo "  2. If you haven't installed an auth recipe yet:"
echo "       auth/better-auth (default) or auth/cloudflare-access"
echo ""
