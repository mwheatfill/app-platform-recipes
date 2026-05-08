# app-platform-recipes

Opt-in additions for the [internal app platform](https://github.com/mwheatfill) templates
(`template-az-spa`, `template-az-fullstack`, future Cloudflare equivalents).

Recipes are self-contained. Each recipe adds a focused capability — a Copilot agent, an MCP
server, an in-app Cmd+K prompt, branded email sending, etc. — by copying a small set of
files into your app and updating dependencies. They are deliberately **not** baked into the
templates: an empty recipe surface keeps templates lean and trustworthy.

## How it works

Each recipe lives under [`recipes/`](./recipes) as a folder named with a `+` prefix
(`+copilot-agent`, `+mcp-server`, …). Inside:

- `README.md` — what this recipe does, which templates it supports, what it adds, what to
  configure after install
- `files/` — files to copy verbatim into the consuming app (paths under `files/` mirror their
  destination in the app)
- `install.sh` *(optional)* — recipe-specific post-copy steps (e.g., `npm install` for new
  deps, scaffolding placeholders)
- `compatibility.json` — declares supported templates and required versions

## Install a recipe

```bash
# from the consuming app's repo root
curl -sSL https://raw.githubusercontent.com/mwheatfill/app-platform-recipes/main/install.sh | \
  bash -s -- +mcp-server
```

The installer:

1. Verifies you're in a supported template (reads marker file or `package.json` notes)
2. Clones this repo to a temp dir
3. Copies the recipe's `files/` tree into your app
4. Runs `recipes/<name>/install.sh` if present (deps, post-processing)
5. Prints the recipe README's "After install" section

Recipes are **idempotent on copy**: re-running detects existing files and skips them with a
warning. Use `--force` to overwrite (rarely what you want — usually you want to upgrade by
diffing manually).

## Available recipes

| Recipe | What it adds | Templates |
| --- | --- | --- |
| [`+copilot-agent`](recipes/+copilot-agent) | Microsoft 365 Copilot declarative agent + API plugin + Adaptive Card response templates. Wraps `/api/openapi.json`. | `az-spa`, `az-fullstack` |
| [`+cmdk-prompt`](recipes/+cmdk-prompt) | In-app Cmd+K natural-language prompt with shared instructions/tools so Copilot agent and SPA prompt reuse the same brain. | `az-spa` |
| [`+mcp-server`](recipes/+mcp-server) | Model Context Protocol server exposing the API as agent tools (Claude Desktop, Cursor, ChatGPT desktop, custom runtimes). Stdio + Streamable HTTP transports. | `az-spa`, `az-fullstack` |
| [`+graph-mail-send`](recipes/+graph-mail-send) | Microsoft Graph `Mail.Send` from a shared mailbox + React Email templates. Branded HTML, Outlook-compatible. | `az-spa`, `az-fullstack` |

## Pattern principles

Recipes that follow these stay maintainable. Drift from them and you'll regret it:

1. **Recipes wrap, never replace.** A recipe layers on top of the template's existing
   conventions. If your recipe wants to redefine `_shared/auth.ts` or change the
   OpenAPI registration pattern, that's a template-level decision, not a recipe.
2. **Single source of truth for the API contract.** Agent layers (Copilot, MCP) consume
   `/api/openapi.json`. They don't reimplement endpoint logic. New endpoints in the API show
   up in the agent surface automatically.
3. **One concern per recipe.** `+copilot-agent` does Copilot. `+mcp-server` does MCP.
   `+cmdk-prompt` does the in-app prompt. Don't bundle.
4. **Composable.** Recipes can coexist. Installing all four should work without conflicts.
5. **Honest READMEs.** Every recipe README declares: required env vars, required app
   registration permissions, what's left to configure manually, what the recipe does NOT
   handle.
6. **Versioned by git.** Recipes are tracked in this repo. To pick up an updated recipe in an
   existing app, re-run install (it'll diff and warn) or cherry-pick the specific files. No
   automatic update mechanism — by design, at this scale.

## Adding a new recipe

Open a PR. Each new recipe needs:

- `recipes/+name/README.md` (template: see existing recipes)
- `recipes/+name/files/` with the files to copy
- `recipes/+name/compatibility.json` declaring supported templates
- An entry in the table above

Keep recipes small. If a recipe is doing too much, it's two recipes.
