# `+mcp-server`

Adds a Model Context Protocol server that exposes the app's REST API as agent tools. After
install, MCP-aware clients (Claude Desktop, Cursor, ChatGPT desktop, custom agent runtimes)
can call any endpoint in your `/api/openapi.json` spec via natural language.

## Supported templates

`template-az-spa`, `template-az-fullstack`.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `mcp/server.ts` | The MCP server. Reads `/api/openapi.json` at startup, exposes each operation as an MCP tool, forwards calls to the API. |
| `mcp/package.json` | Independent Node project — its own deps, separate from `api/` and the root SPA |
| `mcp/tsconfig.json` | Node 22 + ESM + strict |
| `mcp/.gitignore` | Excludes `node_modules`, `dist` |
| `mcp/README.md` | Per-app config: how to wire it into Claude Desktop, etc. |

## Pattern

The server is a **wrapper over the OpenAPI spec**, not a parallel implementation. New
endpoints added to `api/src/functions/` automatically show up as MCP tools — restart the MCP
client to pick them up. There's nothing to update in `mcp/` when the API grows.

## Required configuration

Set as environment variables in the MCP client config (or a local `.env` for development):

| Var | Required | Purpose |
| --- | --- | --- |
| `API_BASE_URL` | yes | Base URL of the API. e.g. `https://oncall.stlabs.org` (production) or `http://localhost:7071` (SWA CLI dev) |
| `OPENAPI_SPEC_URL` | no | Override the spec location. Defaults to `${API_BASE_URL}/api/openapi.json` |
| `AGENT_API_KEY` | recommended | Passed as `x-agent-key` header. Required if your API uses the per-route auth pattern; see [AGENTS.md](https://github.com/mwheatfill/template-az-spa/blob/main/AGENTS.md#per-route-auth-agent-invocation-without-easyauth) in the template. |
| `MCP_SERVER_NAME` | no | Advertised server name. Default: `app-platform-mcp` |

## Auth model

MCP clients run outside any EasyAuth session. They cannot present a tenant-user identity.
For the MCP server to call your API, you need either:

1. **Per-route auth pattern (recommended)** — add a `/api/agent/*` route in
   `staticwebapp.config.json` that bypasses EasyAuth, and have the Function validate
   `x-agent-key`. Set `AGENT_API_KEY` in both the SWA app settings and the MCP client config.
2. **Local-only operation** — point `API_BASE_URL` at your SWA CLI (`http://localhost:7071`)
   for development without auth.

Don't expose EasyAuth-gated routes to the MCP server with no key — they'll 302 redirect to
the AAD sign-in page and break.

## After install

```bash
# Install the MCP server's deps
cd mcp && npm install && npm run build && cd ..

# Wire into Claude Desktop
# macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
# Add to the "mcpServers" object:
{
  "mcpServers": {
    "your-app-name": {
      "command": "node",
      "args": ["/absolute/path/to/your-app/mcp/dist/server.js"],
      "env": {
        "API_BASE_URL": "https://your-app.azurestaticapps.net",
        "AGENT_API_KEY": "..."
      }
    }
  }
}

# Restart Claude Desktop. The app's endpoints appear as tools in the MCP picker.
```

For Cursor, ChatGPT desktop, or other clients, consult their MCP server config docs — same
shape (`command`, `args`, `env`).

## Hosted MCP (optional, future)

The bundled server uses **stdio** transport — perfect for desktop clients that spawn it as a
subprocess. For server-to-server agents, the MCP SDK also supports **Streamable HTTP**. To
switch:

```ts
// In server.ts, replace StdioServerTransport with the HTTP transport.
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
```

You can host the resulting binary on Cloudflare Workers, Azure Container Apps, or anywhere
that can run a long-lived process. Out of scope for this recipe — extend per-app.

## Not handled

- **Bidirectional auth flows** — recipe assumes one API key. OAuth on-behalf-of would require
  the MCP client to flow user identity, which depends on the client.
- **Tool input schema derivation from OpenAPI types** — current version uses generic
  `{ path, query, body }` shapes. For richer typing, add `openapi-zod-client` and convert
  parameter schemas at startup. See `mcp/server.ts` for the extension point.
- **Streaming responses** — tools return the full response when complete. Streaming would
  require switching to the higher-level resource API in the MCP SDK.
- **Tool deprecation** — when an endpoint is removed from the API, the tool disappears at
  next restart. No grace period.

## Why this is the reference recipe

`+mcp-server` is the cleanest demonstration of the platform's "single source of truth"
principle. The OpenAPI spec at `/api/openapi.json` is the contract. The MCP server reads it,
exposes tools, forwards calls. Zero parallel implementation. Add an endpoint, get an MCP tool.

Use this pattern as the model for `+copilot-agent` and any future agent surfaces.
