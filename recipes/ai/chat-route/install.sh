#!/usr/bin/env bash
set -euo pipefail

echo "▶ Installing ai + AI SDK core..."
pnpm add ai

echo ""
echo "▶ Manual steps remaining:"
echo ""
echo "  1. Install an auth recipe if you haven't already:"
echo "       auth/better-auth (default) or auth/cloudflare-access"
echo ""
echo "  2. Install an AI provider recipe (provides src/lib/ai/client.ts):"
echo "       microsoft-foundry/chat-completion (default)"
echo "       cloudflare-workers-ai/setup"
echo "       anthropic/chat-completion"
echo "       openai/chat-completion"
echo ""
echo "  3. Install ai/chat-ui to mount the chat surface."
echo ""
