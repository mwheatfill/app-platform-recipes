#!/usr/bin/env bash
# Post-copy hook for +mcp-server. Runs after install.sh has copied files into the consuming
# app's mcp/ directory.

set -euo pipefail

if [ ! -d mcp ]; then
  echo "✗ mcp/ folder not found. Recipe copy may have failed." >&2
  exit 1
fi

echo "▶ Installing MCP server deps..."
(cd mcp && npm install)

echo "▶ Building..."
(cd mcp && npm run build)

cat <<'EOF'

✅ MCP server is built. Next steps:

  1. Make sure your API exposes a per-route auth path. See AGENTS.md → "Per-route auth".
     Set AGENT_API_KEY in SWA app settings (az staticwebapp appsettings set).

  2. Wire the server into your MCP client. For Claude Desktop, edit:
       macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json
       Windows: %APPDATA%\Claude\claude_desktop_config.json

     Add to "mcpServers":

       "your-app-name": {
         "command": "node",
         "args": ["PWD-PLACEHOLDER/mcp/dist/server.js"],
         "env": {
           "API_BASE_URL": "https://your-app.azurestaticapps.net",
           "AGENT_API_KEY": "..."
         }
       }

     (Replace PWD-PLACEHOLDER with the absolute path to this repo.)

  3. Restart Claude Desktop. The app's endpoints appear as MCP tools.

See mcp/README.md and the recipe README for more.

EOF
