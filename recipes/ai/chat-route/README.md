---
title: "ai/chat-route"
type: "Recipe"
status: Active
description: "Auth-protected streaming chat endpoint for the cf-fullstack template. Includes the Content-Encoding: identity Workers SSE fix in the handler."
---

# `ai/chat-route`

Auth-protected `POST /api/chat` endpoint that streams AI responses to the client. Uses the Vercel AI SDK's `streamText` and the template's `getCurrentUser` abstraction. Pairs with [`ai/chat-ui`](../chat-ui) for the chat surface.

## Supported templates

`template-cf-fullstack`.

## Dependencies (install first)

This recipe assumes both:

- An auth provider recipe is installed (e.g., [`auth/better-auth`](../../auth/better-auth) or [`auth/cloudflare-access`](../../auth/cloudflare-access)). Without one, `getCurrentUser` returns null and every chat request 401s.
- An AI provider recipe is installed (e.g., [`microsoft-foundry/chat-completion`](../../microsoft-foundry/chat-completion), [`cloudflare-workers-ai/setup`](../../cloudflare-workers-ai/setup), [`anthropic/chat-completion`](../../anthropic/chat-completion), or [`openai/chat-completion`](../../openai/chat-completion)). The provider recipe ships `src/lib/ai/client.ts` with the `getAIClient()` factory that this recipe imports.

The composer enforces this order at install time. Manual installation: install both dependencies first.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/routes/api/chat.ts` | TanStack Start API route at `/api/chat`. Validates input with Zod, resolves the current user (returns 401 if no session), calls `streamText`, returns the SSE stream with the `Content-Encoding: identity` Workers fix applied. |

## Why the SSE fix matters

Cloudflare Workers' default response compression buffers the SSE stream so the chat appears to hang. Setting `Content-Encoding: identity` on the streaming response disables compression for that response. **Don't remove this line** — without it, no streamed token reaches the client until the model finishes.

## Required configuration

None at this layer. The auth recipe and AI provider recipe handle their own env vars.

## What this recipe does NOT handle

- **Rate limiting.** Cloudflare's WAF rate-limit rules are the right primitive; configure per route via the dashboard or via Wrangler.
- **Multi-step tool calling.** `streamText` supports `maxSteps` and tool definitions; extend the handler to add tools as needed.
- **Conversation persistence.** This handler is stateless. Pass `messages` from the client (`useChat` does this); persist to your DB if you need history.

## After install

```bash
pnpm dev
# Open the chat UI (install ai/chat-ui), sign in, send a message.
# If you get 401, your auth recipe isn't wired or you're not logged in.
# If you get 500, your AI provider recipe isn't fully configured (env vars).
```
