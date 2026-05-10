#!/usr/bin/env bash
# Validate and package the curated Microsoft 365 Copilot agent files.

set -euo pipefail

AGENT_DIR="${AGENT_DIR:-agent}"
OUT_DIR="${OUT_DIR:-dist/agent}"
OUT_FILE="$OUT_DIR/copilot-agent.zip"

required_files=(
  "$AGENT_DIR/manifest.json"
  "$AGENT_DIR/declarativeAgent.json"
  "$AGENT_DIR/plugin.json"
  "$AGENT_DIR/openapi.json"
  "$AGENT_DIR/instructions.md"
  "$AGENT_DIR/adaptiveCards/default.json"
  "$AGENT_DIR/icons/color.png"
  "$AGENT_DIR/icons/outline.png"
)

for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "Missing required agent file: $file" >&2
    exit 1
  fi
done

AGENT_DIR="$AGENT_DIR" node <<'NODE'
const { readFileSync } = require("node:fs");
const agentDir = process.env.AGENT_DIR ?? "agent";

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.error(`Invalid JSON in ${path}: ${error.message}`);
    process.exit(1);
  }
}

const manifest = readJson(`${agentDir}/manifest.json`);
const declarativeAgent = readJson(`${agentDir}/declarativeAgent.json`);
const plugin = readJson(`${agentDir}/plugin.json`);
const openapi = readJson(`${agentDir}/openapi.json`);
const instructions = readFileSync(`${agentDir}/instructions.md`, "utf8");

const serialized = JSON.stringify({ manifest, declarativeAgent, plugin, openapi, instructions });
if (serialized.includes("REPLACE_ME")) {
  console.error("Agent files still contain REPLACE_ME placeholders.");
  process.exit(1);
}

const serverUrl = openapi.servers?.[0]?.url;
if (!serverUrl || !/^https:\/\/[^/]+/.test(serverUrl)) {
  console.error("agent/openapi.json servers[0].url must be pinned to the public https app host.");
  process.exit(1);
}

const paths = Object.keys(openapi.paths ?? {});
if (paths.length === 0) {
  console.error("agent/openapi.json must expose at least one curated action path.");
  process.exit(1);
}

if (paths.some((path) => path.includes("openapi") || path.includes("swagger"))) {
  console.error("Do not expose generated OpenAPI or Swagger routes through the Copilot agent contract.");
  process.exit(1);
}

for (const [path, operations] of Object.entries(openapi.paths ?? {})) {
  if (!path.startsWith("/api/agent/")) {
    console.error(`Copilot action path must be a dedicated /api/agent/* route: ${path}`);
    process.exit(1);
  }

  for (const [method, operation] of Object.entries(operations ?? {})) {
    if (method.toLowerCase() === "get") {
      if (operation["x-openai-isConsequential"] !== false || operation["x-oai-isConsequential"] !== false) {
        console.error(`Read-only GET ${path} must mark both consequential flags false.`);
        process.exit(1);
      }
    }
  }
}

const operationIds = new Set(
  Object.values(openapi.paths ?? {}).flatMap((operations) =>
    Object.values(operations ?? {})
      .map((operation) => operation?.operationId)
      .filter(Boolean),
  ),
);

for (const fn of plugin.functions ?? []) {
  if (!operationIds.has(fn.name)) {
    console.error(`Plugin function ${fn.name} does not match any operationId in agent/openapi.json.`);
    process.exit(1);
  }
}

for (const runtime of plugin.runtimes ?? []) {
  for (const fnName of runtime.run_for_functions ?? []) {
    if (!operationIds.has(fnName)) {
      console.error(`Runtime references ${fnName}, but agent/openapi.json has no matching operationId.`);
      process.exit(1);
    }
  }
}

if (plugin.runtimes?.some((runtime) => runtime.spec?.url?.includes("/api/openapi"))) {
  console.error("agent/plugin.json must not point at the full generated app OpenAPI.");
  process.exit(1);
}
NODE

mkdir -p "$OUT_DIR"
rm -f "$OUT_FILE"

(
  cd "$AGENT_DIR"
  zip -qr "../$OUT_FILE" \
    manifest.json \
    declarativeAgent.json \
    plugin.json \
    openapi.json \
    instructions.md \
    adaptiveCards \
    icons
)

echo "Packaged $OUT_FILE"
