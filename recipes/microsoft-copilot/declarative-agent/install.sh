#!/usr/bin/env bash
# Post-copy hook for +copilot-agent.

set -euo pipefail

if [ ! -d agent ]; then
  echo "✗ agent/ folder not found." >&2
  exit 1
fi

# Generate a fresh UUID for the manifest if uuidgen is available
if command -v uuidgen >/dev/null 2>&1; then
  NEW_UUID=$(uuidgen | tr 'A-Z' 'a-z')
  if grep -q "REPLACE_ME-uuid-v4" agent/manifest.json; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s/REPLACE_ME-uuid-v4-generate-with-uuidgen/$NEW_UUID/g" agent/manifest.json
    else
      sed -i "s/REPLACE_ME-uuid-v4-generate-with-uuidgen/$NEW_UUID/g" agent/manifest.json
    fi
    echo "▶ Inserted manifest UUID: $NEW_UUID"
  fi
fi

cat <<'EOF'

✅ Copilot agent files installed at agent/.

Next steps:

  1. Replace REPLACE_ME placeholders in:
       agent/declarativeAgent.json  (name, description, conversation starters)
       agent/plugin.json            (name, namespace, OpenAPI URL, secret reference)
       agent/manifest.json          (developer info, name, description, valid domain)
       agent/instructions.md        (full system prompt for your app)

  2. Customize agent/adaptiveCards/default.json for your data shape. The default is a
     person-card layout (photo, name, role, email/Teams actions). Single-column layouts
     render best across all Copilot surfaces.

  3. Generate real icons. See agent/icons/README.md.

  4. Install the Microsoft 365 Agents Toolkit CLI:
       npm i -g @microsoft/m365agentstoolkit-cli

  5. Validate, provision, and sideload:
       m365agents validate
       m365agents provision
       m365agents deploy
       m365agents launch

  6. (Optional) Set up an API key for plugin auth:
       Add a plugin secret in Teams Toolkit, then update reference_id in plugin.json.
       Set the same key as AGENT_API_KEY in your SWA app settings, and ensure your API
       has the per-route auth pattern (see template's AGENTS.md).

EOF
