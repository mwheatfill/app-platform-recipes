# app-platform-recipes

Opt-in capabilities for the [internal app platform](https://github.com/mwheatfill) templates (`template-cf-fullstack`, `template-az-spa`, `template-az-fullstack`).

Recipes are self-contained. Each recipe adds a focused capability — auth provider, AI chat route, email pipeline, MCP server, etc. — by copying a small set of files into your app and running a per-recipe install hook (`pnpm add` for new deps, scaffolding placeholders, etc.). They are deliberately **not** baked into the templates: an empty recipe surface keeps templates lean, secure, and trustworthy.

## How it works

Each recipe lives under [`recipes/`](./recipes) in a domain-prefixed path (`auth/better-auth`, `mcp/expose-app-as-mcp-server`, …). Inside:

- `README.md` — what this recipe does, which templates it supports, what it adds, what to configure after install
- `files/` — files to copy verbatim into the consuming app (paths under `files/` mirror their destination in the app)
- `install.sh` *(optional)* — recipe-specific post-copy steps (e.g., `pnpm add` for new deps, env-var prompts)
- `compatibility.json` — declares supported templates and required versions

## Install a recipe

```bash
# from the consuming app's repo root
curl -sSL https://raw.githubusercontent.com/mwheatfill/app-platform-recipes/main/install.sh | \
  bash -s -- auth/better-auth
```

The installer:

1. Verifies you're in a supported template (reads `.template-id` and checks `compatibility.json`)
2. Clones this repo to a temp dir
3. Copies the recipe's `files/` tree into your app
4. Runs `recipes/<domain>/<name>/install.sh` if present (deps, post-processing)
5. Prints the recipe README's "After install" section

Recipes are **idempotent on copy**: re-running detects existing files and skips them with a warning. Use `--force` to overwrite (rarely what you want — usually you want to upgrade by diffing manually).

The `.template-id` file at the consuming app's repo root tells the installer which template the app derives from. The template ships this file. Examples: `cf-fullstack`, `az-spa`, `az-fullstack`.

## Available recipes

### Platform layer (the default capabilities)

| Recipe | What it adds | Templates |
| --- | --- | --- |
| `auth/better-auth` | Better Auth with multi-provider env-driven config (email + password, email-OTP, social OAuth, Microsoft Entra OIDC). Implements the template's `getCurrentUser` abstraction. | `cf-fullstack` |
| `auth/cloudflare-access` | Cloudflare Access JWT validation as the auth provider. Same `getCurrentUser` abstraction; provider swap is mechanical. | `cf-fullstack` |
| `ai/chat-route` | Auth-protected streaming chat endpoint with the `Content-Encoding: identity` Workers SSE fix. Depends on an auth recipe. | `cf-fullstack` |
| `ai/chat-ui` | Chat surface using Vercel AI Elements components. | `cf-fullstack` |
| `email/send-pipeline` | `sendEmail(input)` dispatcher with React Email render layer; `email:dev` preview script. Depends on a transport recipe. | `cf-fullstack` |
| `email/welcome-template` | Example React Email template demonstrating the pattern. | `cf-fullstack` |

### AI providers

| Recipe | What it adds | Templates |
| --- | --- | --- |
| `microsoft-foundry/chat-completion` | Default AI provider. Cloudflare AI Gateway → Microsoft Foundry. Multi-step tool calling, direct-Foundry opt-out. | `cf-fullstack` |
| `cloudflare-workers-ai/setup` | Cloudflare-native AI provider, no external API key. | `cf-fullstack` |
| `anthropic/chat-completion` | Anthropic provider. | `cf-fullstack` |
| `openai/chat-completion` | OpenAI provider. | `cf-fullstack` |

### Email transports

| Recipe | What it adds | Templates |
| --- | --- | --- |
| `email/graph-shared-mailbox` | Microsoft Graph send-mail from a shared mailbox via client credentials, scoped via `ApplicationAccessPolicy`. | `cf-fullstack`, `az-fullstack` |
| `email/resend` | Resend transactional sending. | `cf-fullstack` |
| `email/cloudflare-email-service` | Cloudflare Email Service (public beta sending API). | `cf-fullstack` |
| `email/cloudflare-email-routing` | Inbound email at custom domains via Email Workers. | `cf-fullstack` |

### Capability layer

| Recipe | What it adds | Templates |
| --- | --- | --- |
| `data-layer/switch-to-neon-postgres` | Convert from D1 to Neon Postgres + Cloudflare Hyperdrive. | `cf-fullstack` |
| `drizzle/d1-migration` | Pattern for adding a new table or evolving schema. | `cf-fullstack` |
| `entra/group-claim-extraction` | Read groups from a JWT, map to app roles. | `cf-fullstack`, `az-fullstack`, `az-spa` |
| `webhooks/hmac-validation` | Incoming webhook signature verification. | `cf-fullstack` |
| `webhooks/inbound-receiver` | Worker → Queue → consumer → R2 archive. | `cf-fullstack` |
| `teams/adaptive-card-alert` | Post structured cards to Teams Incoming Webhook. | `cf-fullstack`, `az-fullstack`, `az-spa` |
| `teams/presence` | Get presence and subscribe to changes via Graph. | `cf-fullstack`, `az-fullstack`, `az-spa` |
| `pagerduty/event-create` | Fire a v2 PagerDuty event. | `cf-fullstack`, `az-fullstack` |
| `mcp/expose-app-as-mcp-server` | Worker-hosted MCP server over Streamable HTTP, OpenAPI-driven tool generation. Pairs with the template's `.well-known/mcp-server-card`. | `cf-fullstack`, `az-spa`, `az-fullstack` |
| `agent-guards/add-a-guard` | Pattern for adding a CI guard script. Reference: the `openapi-contract` guard in the template. | `cf-fullstack` |
| `testing/playwright-e2e` | Playwright e2e testing. | `cf-fullstack` |
| `health-endpoint/setup` | Opt-in `/health` route with database ping. | `cf-fullstack` |
| `cloudflare/workers-builds-setup` | Zero-config GitHub deploys via Cloudflare Workers Builds. | `cf-fullstack` |
| `cloudflare-tunnel/add-target` | Add a new internal hostname behind Cloudflare Tunnel. | `cf-fullstack` |
| `autotask/ticket-create` | Create or update an Autotask ticket from a Worker. | `cf-fullstack`, `az-fullstack` |

### Microsoft Copilot

| Recipe | What it adds | Templates |
| --- | --- | --- |
| `microsoft-copilot/declarative-agent` | Microsoft 365 Copilot declarative agent + API plugin + Adaptive Card response templates. Wraps `/api/openapi.json`. | `az-spa`, `az-fullstack` |
| `ai/cmdk-prompt` | In-app Cmd+K natural-language prompt with shared instructions/tools so the Copilot agent and the in-app prompt reuse the same brain. | `az-spa` |

## Pattern principles

Recipes that follow these stay maintainable. Drift from them and you'll regret it:

1. **Recipes wrap, never replace.** A recipe layers on top of the template's existing conventions. If your recipe wants to redefine `getCurrentUser` or change the OpenAPI registration pattern, that's a template-level decision, not a recipe.
2. **Single source of truth for the API contract.** Agent layers (Copilot, MCP, generated SDK clients) consume `/api/openapi.json`. They don't reimplement endpoint logic. New endpoints in the API show up in the agent surface automatically.
3. **One concern per recipe.** `auth/better-auth` does Better Auth. `ai/chat-route` does the chat endpoint. `email/send-pipeline` does the dispatcher. Don't bundle.
4. **Composable.** Recipes can coexist. Installing `auth/better-auth` + `ai/chat-route` + `email/send-pipeline` + `email/graph-shared-mailbox` should work without conflicts.
5. **Honest READMEs.** Every recipe README declares: required env vars, required app registration permissions, what's left to configure manually, what the recipe does NOT handle.
6. **Dependency declarations are explicit.** Recipes that depend on other recipes (e.g., `ai/chat-route` requires an auth recipe) state the dependency in `compatibility.json` and the README. The composer enforces order.
7. **Versioned by git.** Recipes are tracked in this repo. To pick up an updated recipe in an existing app, re-run install (it'll diff and warn) or cherry-pick the specific files. No automatic update mechanism — by design, at this scale.

## Adding a new recipe

Open a PR. Each new recipe needs:

- `recipes/<domain>/<name>/README.md` (template: see existing recipes)
- `recipes/<domain>/<name>/files/` with the files to copy
- `recipes/<domain>/<name>/compatibility.json` declaring supported templates
- An entry in the table above

Keep recipes small. If a recipe is doing too much, it's two recipes.
