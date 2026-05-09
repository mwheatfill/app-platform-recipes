---
title: "ai/chat-ui"
type: "Recipe"
status: Active
description: "Removable example chat surface using @ai-sdk/react's useChat. Pairs with ai/chat-route. Replace with Vercel AI Elements components when you want richer chat primitives."
---

# `ai/chat-ui`

A removable example chat surface at `/chat` that calls the `/api/chat` endpoint via `@ai-sdk/react`'s `useChat` hook. Raw Tailwind for the layout (no AI Elements yet); replace with [Vercel AI Elements](https://ai-sdk.dev/elements) components when you want richer primitives (Message, MessageContent, Conversation, Reasoning, ToolCall, etc.).

## Supported templates

`template-cf-fullstack`.

## Dependencies (install first)

- [`ai/chat-route`](../chat-route) ships the `/api/chat` endpoint that this UI calls.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/routes/chat.tsx` | TanStack Start route at `/chat`. Renders message history, an input, and a Send button. Wraps `useChat` with explicit `api: '/api/chat'`. |

## Upgrading to AI Elements

Once the project is comfortable with the basic flow, run:

```bash
npx shadcn@latest add @ai-sdk/elements/conversation
npx shadcn@latest add @ai-sdk/elements/message
# etc.
```

Then replace the manual `<ol>`/`<li>`/`<form>` markup in `src/routes/chat.tsx` with the AI Elements components. The `useChat` hook stays unchanged.

## After install

```bash
pnpm dev
# Open http://localhost:3000/chat
# If you see the page but Send returns 401, install an auth recipe and sign in.
# If Send returns 500, your AI provider recipe isn't fully configured.
```
