# Microsoft 365 Copilot Declarative Agent

Adds a Microsoft 365 Copilot declarative agent, API plugin manifest, curated OpenAPI action
contract, and one conservative Adaptive Card template.

Use this when an app has a small, high-value read workflow that should be available inside
Microsoft 365 Copilot. Do not install it just because the app has an OpenAPI document.

## Supported templates

`template-az-spa`, `template-az-fullstack`.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `agent/manifest.json` | Microsoft 365 app package manifest for sideload/catalog |
| `agent/declarativeAgent.json` | Agent name, instructions, and conversation starters |
| `agent/plugin.json` | API plugin manifest and response semantics |
| `agent/openapi.json` | Hand-curated minimal Copilot action contract |
| `agent/instructions.md` | Agent instructions; keep app-specific and concise |
| `agent/adaptiveCards/default.json` | Flat, card-ready citation template |
| `scripts/package-agent.sh` | Validates and packages only curated agent files |

The recipe does not modify application API code. Add dedicated `/api/agent/<action>` endpoints
yourself when the normal app endpoints are too broad, nested, slow, or auth-bound for Copilot.

## Required configuration

1. Replace all `REPLACE_ME` placeholders in `agent/`.
2. Pin `agent/openapi.json` `servers[0].url` to the public app host, for example
   `https://my-app.azurestaticapps.net`.
3. Keep `agent/openapi.json` minimal. Include only the paths the packaged agent uses.
4. Mark read-only GET operations with both `x-openai-isConsequential: false` and
   `x-oai-isConsequential: false`.
5. Add any public agent route exceptions to `staticwebapp.config.json` deliberately, then
   enforce a scoped key or safe public-data boundary inside the Function.

## Package and sideload

```bash
bash scripts/package-agent.sh
npx -y @microsoft/m365agentstoolkit-cli@1.1.10 install --file-path dist/agent/copilot-agent.zip
```

Prefer `atk` from `@microsoft/m365agentstoolkit-cli`. Avoid the legacy Teams CLI install path;
it can fail in some tenants by requesting placeholder scopes during auth.

Sideloading discipline:

1. Bump `agent/manifest.json` `version` before every install.
2. Package only the curated files in `agent/`.
3. Install with Agents Toolkit.
4. Capture the TitleId and AppId.
5. Start a fresh Copilot chat for the installed package.
6. Verify the title/version in the UI or launch URL before testing.

## Rollout choices

- **Sideload**: one builder account. Best for development.
- **Catalog available**: pilot users can choose to install. Best first admin rollout.
- **Tenant install or pinning**: broad rollout. Avoid until the contract, latency, support
  owner, and branding are stable.

Publishing to a catalog is not the same as installing or pinning for users.

## Verification

```bash
bash scripts/package-agent.sh
curl -i https://your-app.example/api/agent/example
```

Then test in Copilot. If the UI fails:

1. Curl the public action endpoint.
2. Check App Insights for the agent operation.
3. If App Insights has no request, debug install/manifest/orchestration.
4. If App Insights has a non-200 request, debug route/auth/runtime.
5. If App Insights has 200 but Copilot fails, debug response shape, timeout, schema, or card
   semantics.
6. Reinstall with a bumped manifest version before assuming Copilot picked up changes.

## Common failure modes

- `servers[0].url` points at an internal Functions host instead of the public app host.
- The packaged OpenAPI accidentally includes the full app API.
- Copilot must infer filtering from a broad response instead of passing explicit parameters.
- The action path performs slow multi-hop upstream work instead of reading a snapshot.
- Repeated confirmation prompts appear because an old package/version is still installed or
  read-only GET operations are not marked non-consequential.

The first plugin connection prompt is expected. Read-only consequential flags reduce repeated
prompts; they do not remove all host-controlled consent and connection UX.

## Rollback

Remove the sideloaded app for the test account, or withdraw the catalog submission before a
pilot expands. If an action endpoint was made public for the agent, remove that route exception
or rotate its key when rolling the agent back.

## Not handled

- Tenant catalog submission and admin approval.
- OAuth on-behalf-of flows.
- Write actions or consequential workflows.
- Native Microsoft 365 people-card chrome. Adaptive Cards can look profile-like, but host
  placement and native profile surfaces remain Microsoft-controlled.
