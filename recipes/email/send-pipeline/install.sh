#!/usr/bin/env bash
set -euo pipefail

echo "▶ Installing react-email..."
pnpm add react-email

echo ""
echo "▶ Adding email:dev script to package.json..."
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const path = "package.json";
const pkg = JSON.parse(readFileSync(path, "utf8"));
pkg.scripts = pkg.scripts || {};
if (!pkg.scripts["email:dev"]) {
  pkg.scripts["email:dev"] = "email dev --dir src/lib/email/templates --port 3001";
  writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
  console.log("  + scripts.email:dev");
} else {
  console.log("  scripts.email:dev already present; left unchanged");
}
'

echo ""
echo "▶ Manual steps remaining:"
echo ""
echo "  1. Install a transport recipe to actually send mail:"
echo "       email/graph-shared-mailbox (default for internal apps)"
echo "       email/resend (consumer transactional)"
echo "       email/cloudflare-email-service (Cloudflare-native)"
echo ""
echo "  2. Set EMAIL_TRANSPORT and transport-specific env vars"
echo "     in .dev.vars."
echo ""
echo "  3. Optional: install email/welcome-template for a starter."
echo ""
