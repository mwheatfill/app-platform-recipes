#!/usr/bin/env bash
set -euo pipefail

echo "▶ Installing @ai-sdk/react..."
pnpm add @ai-sdk/react

echo ""
echo "▶ Manual steps remaining:"
echo ""
echo "  1. Make sure ai/chat-route is installed (provides /api/chat)."
echo ""
echo "  2. Optional: upgrade to Vercel AI Elements components"
echo "     (https://ai-sdk.dev/elements) when you want richer primitives:"
echo ""
echo "       npx shadcn@latest add @ai-sdk/elements/conversation"
echo "       npx shadcn@latest add @ai-sdk/elements/message"
echo ""
