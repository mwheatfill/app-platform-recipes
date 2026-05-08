# mcp/ — MCP server for this app

Wraps the app's REST API as Model Context Protocol tools. MCP clients (Claude Desktop,
Cursor, ChatGPT desktop, custom runtimes) can call any endpoint in `/api/openapi.json`
through this server.

## Run locally

```bash
cd mcp
npm install
npm run build
API_BASE_URL=http://localhost:7071 node dist/server.js
```

For SWA CLI dev, set `API_BASE_URL=http://localhost:4280` (the SWA CLI proxy port).

## Wire into Claude Desktop

Edit:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "your-app-name": {
      "command": "node",
      "args": ["/absolute/path/to/this/repo/mcp/dist/server.js"],
      "env": {
        "API_BASE_URL": "https://your-app.azurestaticapps.net",
        "AGENT_API_KEY": "your-key"
      }
    }
  }
}
```

Restart Claude Desktop. The app's endpoints appear as tools.

## How it works

At startup, `server.ts` fetches the OpenAPI spec from `OPENAPI_SPEC_URL` (defaults to
`${API_BASE_URL}/api/openapi.json`) and registers one MCP tool per `(path, method)` pair.
Tool names come from the operation's `operationId`. Tool descriptions come from the
operation's `description` or `summary`.

When a client calls a tool:

1. Build the URL: `API_BASE_URL/api/<path>` with path params substituted
2. Append query string from the `query` arg
3. Add `x-agent-key: AGENT_API_KEY` header
4. Issue the request, return the response body as text

To add a new endpoint, add a new Function in `api/src/functions/` (template's standard
`registerFunction` pattern). Restart the MCP client. Your new endpoint is a new tool.

## Extending

The recipe's input shapes are intentionally generic (`{ path, query, body }`). For richer
typing — full Zod schemas derived from OpenAPI parameter types — add `openapi-zod-client` and
swap the `buildInputShape` function. The rest of `server.ts` is unaffected.

To run the server over **Streamable HTTP** instead of stdio (for hosted scenarios), import
`StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk/server/streamableHttp.js`
and wire it via Express/Hono. Out of scope for the bundled implementation.
