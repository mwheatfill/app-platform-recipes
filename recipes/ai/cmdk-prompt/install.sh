#!/usr/bin/env bash
# Post-copy hook for +cmdk-prompt.
#
# - Adds shadcn dialog + input components (idempotent: shadcn skips existing)
# - Installs new SPA deps (none — uses existing fetch + cmdk via shadcn Dialog)
# - Installs new api/ deps (ai SDK + Azure provider)

set -euo pipefail

if [ ! -d src ] || [ ! -d api ]; then
  echo "✗ Expected src/ and api/ folders. Run from the repo root." >&2
  exit 1
fi

echo "▶ Adding shadcn components (dialog, input)..."
if [ -x "$(command -v npx)" ]; then
  npx shadcn@latest add dialog input
else
  echo "  (npx not found — run 'npx shadcn@latest add dialog input' manually)"
fi

echo "▶ Installing api/ deps for Azure OpenAI..."
(cd api && npm install ai@^6.0.0 @ai-sdk/azure@^3.0.0)

cat <<'EOF'

✅ +cmdk-prompt installed.

Next steps:

  1. Mount the dialog in your layout. In src/routes/__root.tsx (or your root component):

       import { AgentPromptDialog } from "@/components/agent-prompt";
       // Inside the JSX tree:
       <AgentPromptDialog />

     The dialog mounts globally and listens for ⌘K / Ctrl+K.

  2. Edit agent/instructions.md — replace the REPLACE_ME content with your app's system
     prompt. (Already shared with +copilot-agent if installed.)

  3. Add tools for your endpoints in api/src/lib/agent-tools.ts. The file ships with one
     example (getHealth). Add one entry per operation you want the agent to call.

  4. Set Azure OpenAI app settings in SWA:

       az staticwebapp appsettings set \
         --name "$SWA_NAME" --resource-group "$RG" \
         --setting-names \
           "AZURE_OPENAI_API_KEY=..." \
           "AZURE_OPENAI_RESOURCE_NAME=..." \
           "AZURE_OPENAI_DEPLOYMENT=gpt-4o"

     (Or the equivalent for Anthropic — switch the import in api/src/functions/ask.ts.)

  5. Add the import line to api/src/index.ts so the function registers:

       import "./functions/ask.js";

  6. Test locally:

       npm run dev:swa
       # In the app, press ⌘K and ask "what is the service health?"

EOF
