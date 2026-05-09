#!/usr/bin/env bash
set -euo pipefail

echo "▶ Installing @ai-sdk/azure..."
pnpm add @ai-sdk/azure

echo ""
echo "▶ Manual steps remaining:"
echo ""
echo "  1. Create the Cloudflare AI Gateway in the dashboard"
echo "     (https://dash.cloudflare.com/?to=/:account/ai/ai-gateway)"
echo "     with Azure OpenAI as the upstream provider, pointing at"
echo "     your Microsoft Foundry resource."
echo ""
echo "  2. Set the following env vars in .dev.vars:"
echo ""
echo "       AI_PROVIDER=foundry"
echo "       FOUNDRY_AI_GATEWAY_URL=<your-gateway-url>"
echo "       FOUNDRY_API_KEY=<your-foundry-api-key>"
echo "       FOUNDRY_API_VERSION=v1"
echo "       FOUNDRY_DEPLOYMENT=<your-deployment-name>"
echo ""
echo "  3. Install ai/chat-route + ai/chat-ui to get a working chat"
echo "     endpoint and surface."
echo ""
