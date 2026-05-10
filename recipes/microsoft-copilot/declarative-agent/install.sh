#!/usr/bin/env bash
# Post-copy hook for +copilot-agent.

set -euo pipefail

if [ ! -d agent ]; then
  echo "✗ agent/ folder not found." >&2
  exit 1
fi

# Generate a fresh UUID for the manifest placeholder if uuidgen is available.
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
       agent/plugin.json            (name, namespace, auth reference, operationId)
       agent/openapi.json           (public host, dedicated /api/agent/* path, schema)
       agent/manifest.json          (developer info, name, description, valid domain, version)
       agent/instructions.md        (full system prompt for your app)

  2. Customize agent/adaptiveCards/default.json for your flat card data. Keep it conservative:
     no fixed widths, no action buttons until validated in the target host.

  3. Generate real icons. See agent/icons/README.md.

  4. Package the curated agent files:
       bash scripts/package-agent.sh

  5. Sideload with Agents Toolkit:
       npx -y @microsoft/m365agentstoolkit-cli@1.1.10 install --file-path dist/agent/copilot-agent.zip

  6. For pilot rollout, publish as available to a small group before any tenant-wide install
     or pinning.

EOF
