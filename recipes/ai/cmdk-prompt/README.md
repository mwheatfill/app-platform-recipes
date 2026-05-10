# `+cmdk-prompt`

Adds an in-app Cmd+K natural-language prompt to the SPA, backed by Azure OpenAI (or
Anthropic) tool calling. The prompt **shares its brain** — instructions and tool definitions
— with the `+copilot-agent` recipe, so a question typed in the SPA gets the same treatment
as the same question asked of the Copilot agent.

## Supported templates

`template-az-spa`.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `agent/instructions.md` | System prompt — the shared "brain". Edit this once; both Copilot and Cmd+K read it. |
| `src/components/agent-prompt/` | Cmd+K UI built on `cmdk` + shadcn, with result rendering |
| `src/lib/agent.ts` | Client wrapper that POSTs to `/api/ask` |
| `api/src/functions/ask.ts` | New Function: takes `{ message }`, calls Azure OpenAI with tool-calling, forwards tool calls to other Functions, returns final response + structured data |
| `api/src/lib/tools-from-openapi.ts` | Helper that derives tool definitions from `/api/openapi.json` so adding a new endpoint to the API automatically makes it available to the prompt |

## Required configuration

After install, edit:

1. **`agent/instructions.md`** — system prompt for the LLM. Describe what your app helps with,
   how to interpret time references, what the response style should be, what data lives where.
2. **`src/components/agent-prompt/keybinding.ts`** — confirm the global Cmd+K (⌘K / Ctrl+K)
   binding doesn't conflict with another shortcut your app uses.
3. **Provider env vars** — set in SWA app settings via `az staticwebapp appsettings set`:
   - For Azure OpenAI: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_KEY`
   - For Anthropic: `ANTHROPIC_API_KEY`
   The recipe defaults to Azure OpenAI; flip the import in `api/src/functions/ask.ts` to
   switch providers (both work via the AI SDK).

## Required permissions

- An Azure OpenAI resource with a chat completion deployment, OR an Anthropic API key
- No new Entra ID permissions

## After install

```bash
npm install   # picks up the new deps (ai sdk, etc.)
npm run dev:swa
# Open the app, hit Cmd+K, type "show me the current status"
```

## Not handled

- **Multi-turn conversations** — the prompt is single-turn by default. Each query is
  independent. Add conversation state in a separate iteration if needed.
- **Streaming UI** — the response renders after the LLM finishes. Streaming would be ~half a
  day to add (SSE on the Function, incremental render in the component).
- **Voice input** — out of scope; add via the Web Speech API if needed.
- **Long-running queries (>45s)** — SWA Functions cap at 45s. If a query genuinely needs
  longer (large bulk operations), that's a Tier 2 promotion signal.

## Why share the brain with Copilot

When both `+copilot-agent` and `+cmdk-prompt` are installed, you have two surfaces — Copilot
and the SPA's Cmd+K — but one definition of agent behavior. Update `agent/instructions.md`,
both surfaces pick it up. Add a new endpoint to the API, both surfaces can call it. This is
the whole point: surfaces multiply, definitions don't.
