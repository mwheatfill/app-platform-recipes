#!/usr/bin/env bash
# Post-copy hook for +graph-mail-send.

set -euo pipefail

if [ ! -d api ]; then
  echo "✗ api/ folder not found." >&2
  exit 1
fi

echo "▶ Installing api/ deps for React Email + Graph mail send..."
(cd api && npm install \
  @react-email/components@^1.0.12 \
  @react-email/render@^2.0.8 \
  react@^19.2.0 \
  react-dom@^19.2.0)

echo "▶ Ensuring api/tsconfig.json supports JSX..."
node - <<'NODE_EOF'
const fs = require('node:fs');
const path = 'api/tsconfig.json';
const cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
cfg.compilerOptions ||= {};
let changed = false;
if (cfg.compilerOptions.jsx !== 'react-jsx') {
  cfg.compilerOptions.jsx = 'react-jsx';
  changed = true;
}
if (cfg.compilerOptions.jsxImportSource !== 'react') {
  cfg.compilerOptions.jsxImportSource = 'react';
  changed = true;
}
if (changed) {
  fs.writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n');
  console.log('  patched: jsx + jsxImportSource');
} else {
  console.log('  already configured');
}
NODE_EOF

echo "▶ Adding @types/react for the email templates..."
(cd api && npm install --save-dev @types/react@^19.0.0)

cat <<'EOF'

✅ +graph-mail-send installed.

Next steps:

  1. Add the import to api/src/index.ts so the test Function registers:

       import "./functions/send-test-email.js";

  2. Set required app settings in SWA:

       az staticwebapp appsettings set \
         --name "$SWA_NAME" --resource-group "$RG" \
         --setting-names \
           "SHARED_MAILBOX_ADDRESS=noreply@your-domain.com" \
           "MAIL_FROM_NAME=Your App Notifications" \
           "APP_NAME=Your App" \
           "APP_URL=https://your-app.azurestaticapps.net"

  3. Grant Mail.Send (Application) permission on the app's Entra registration:

       az ad app permission add --id "$AAD_CLIENT_ID" \
         --api 00000003-0000-0000-c000-000000000000 \
         --api-permissions b633e1c5-b582-4048-a93e-9f11b44c7e96=Role
       az ad app permission admin-consent --id "$AAD_CLIENT_ID"

     (Mail.Send application permission GUID: b633e1c5-b582-4048-a93e-9f11b44c7e96)

  4. Deploy and validate end-to-end:

       curl -X POST https://your-app.azurestaticapps.net/api/send-test-email \
         -H "Content-Type: application/json" \
         -d '{"to": "you@example.com"}'

  5. After verification, DELETE api/src/functions/send-test-email.ts. Production apps should
     have purpose-built send endpoints, not a generic test endpoint exposed in production.

EOF
