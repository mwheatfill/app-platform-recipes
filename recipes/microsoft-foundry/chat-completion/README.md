---
title: "microsoft-foundry/chat-completion"
type: "Recipe"
status: Active
description: "Default AI provider for the cf-fullstack template. Cloudflare AI Gateway → Microsoft Foundry. Provider-agnostic AI SDK code; swap is a config change."
---

# `microsoft-foundry/chat-completion`

Wires Microsoft Foundry as the AI provider via Cloudflare AI Gateway. Implements the `getAIClient()` factory that recipes like [`ai/chat-route`](../../ai/chat-route) consume. The Vercel AI SDK's Azure OpenAI provider talks to Foundry directly (Foundry is Azure-OpenAI-API-compatible) and the AI Gateway URL fronts it for logging, caching, rate-limiting, cost tracking, and fallback routing.

## Supported templates

`template-cf-fullstack`.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/lib/ai/client.ts` | `getAIClient()` returns a configured Azure OpenAI provider pointed at the AI Gateway URL. `getDefaultModelName()` returns the deployment name. Throws on missing env. |
| `src/env-foundry.d.ts` | Augments `Cloudflare.Env` with `AI_PROVIDER`, `FOUNDRY_AI_GATEWAY_URL`, `FOUNDRY_API_KEY`, `FOUNDRY_API_VERSION`, `FOUNDRY_DEPLOYMENT`. |

## Required configuration

Add to `.dev.vars` (gitignored). For deployed environments use `wrangler secret put`.

| Var | Required | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | yes | Set to `foundry`. |
| `FOUNDRY_AI_GATEWAY_URL` | yes | Cloudflare AI Gateway URL fronting your Foundry resource. Format: `https://gateway.ai.cloudflare.com/v1/<account>/<gateway>/azure-openai/<resource>/<deployment>` |
| `FOUNDRY_API_KEY` | yes | API key for the Foundry resource. |
| `FOUNDRY_API_VERSION` | no | Defaults to `v1`. Override per Foundry deployment requirements. |
| `FOUNDRY_DEPLOYMENT` | yes | The Foundry deployment name (model identifier in Azure parlance). |

## Setup steps

1. **Create the Foundry resource** in Azure (or use an existing one).
2. **Create a Cloudflare AI Gateway** in the Cloudflare dashboard, with Azure OpenAI as the upstream provider, pointing at your Foundry resource.
3. **Set the env vars** above in `.dev.vars` (and via `wrangler secret put` for deployed environments).
4. Install [`ai/chat-route`](../../ai/chat-route) and [`ai/chat-ui`](../../ai/chat-ui) for a working chat surface.

## Direct-Foundry opt-out

For latency-sensitive paths, skip the AI Gateway and call Foundry directly. Override `getAIClient()` to construct `createAzure({ baseURL: '<foundry-direct-url>', ... })` instead of the gateway URL. Lose the Gateway features (logging, caching, rate-limiting); gain ~10-50ms per call.

## Multi-step tool calling

`streamText` supports `maxSteps` and tool definitions. See the [Vercel AI SDK docs](https://ai-sdk.dev/docs) for the patterns; the recipe doesn't pre-wire any tools.

## TanStack AI watch list

`tanstack-ai` is alpha and requires Node.js 24+. Migration from Vercel AI SDK is a config change once it hits 1.0 and the chat-UI ecosystem (AI Elements) supports it. Monitor [tanstack.com/ai](https://tanstack.com/ai) for the 1.0 milestone.

## What this recipe does NOT handle

- **AI Gateway provisioning.** You create that in the Cloudflare dashboard.
- **Foundry resource provisioning.** You create that in the Azure portal.
- **Tool definitions.** The recipe ships only the client + model factory.
- **Cost monitoring or rate-limit tuning.** Configure those in the AI Gateway dashboard.

## Always write "Microsoft Foundry"

In docs and user-facing text, use the current name "Microsoft Foundry" (not "Azure AI Foundry" or "Azure OpenAI" alone). Code identifiers and env vars use `FOUNDRY_*`.
