# `+copilot-agent`

Adds a Microsoft 365 Copilot declarative agent + API plugin + Adaptive Card response
templates, all wrapping `/api/openapi.json`. After install the agent can be sideloaded into
Microsoft 365 Copilot (Teams, M365 web, Outlook) and respond to natural-language queries
backed by your existing API.

## Supported templates

`template-az-spa`, `template-az-fullstack`.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `agent/declarativeAgent.json` | Agent identity, instructions to the LLM, conversation starters |
| `agent/plugin.json` | API plugin manifest pointing at `/api/openapi.json` |
| `agent/adaptiveCards/` | Static response templates Copilot uses to render API responses |
| `agent/manifest.json` | Teams app manifest for sideload / catalog submission |
| `agent/icons/` | Color (192×192) + outline (32×32) icons (placeholders to replace) |

The recipe does **not** touch your existing API code. The agent reads endpoints, schemas, and
operationIds from the OpenAPI spec.

## Required configuration

After install, edit:

1. **`agent/declarativeAgent.json`** — agent name, description, instructions. Instructions are
   the system prompt that shapes how the LLM interprets natural language. Keep them concise:
   one paragraph describing what the agent helps with, a sentence on how to interpret time
   queries, conventions for what to show.
2. **`agent/plugin.json`** — `api.url` should point at your deployed `/api/openapi.json` URL
   (the SWA hostname or custom domain).
3. **`agent/adaptiveCards/*.json`** — design the cards for your data shape. Single-column
   layouts render best across all Copilot surfaces (Teams chat is the narrowest).

If your API endpoints require an API key (the `/api/agent/*` per-route auth pattern), add the
key as a Copilot plugin secret. See the agent SDK docs for the current procedure.

## Required Entra ID permissions

None for the agent itself. The agent calls your API as the user (delegated identity flowing
through Copilot). If your API in turn calls Microsoft Graph with app permissions, that's
already configured in the template's bootstrap script.

## After install

```bash
# Install the Microsoft 365 Agents Toolkit CLI (one-time)
npm i -g @microsoft/m365agentstoolkit-cli

# From your repo root, with agent/ populated:
m365agents validate
m365agents provision   # registers the agent in your tenant
m365agents deploy      # uploads to Microsoft 365
m365agents launch      # opens Teams with the agent sideloaded
```

For tenant-wide rollout, submit through your Teams admin center after sideload validation.

## Not handled

- **Tenant catalog submission** — manual one-time admin step
- **Multi-language content** — single-language by default
- **Action button callbacks** (mid-conversation actions that POST back to your API) —
  `Action.OpenUrl` covers most cases (Teams chat deep link, mailto:); richer callbacks need
  custom plumbing per the Copilot extensibility docs
- **OAuth on-behalf-of** — recipe assumes the API is callable with an API key for service
  scenarios; OBO flow for delegated user identity is a separate concern
