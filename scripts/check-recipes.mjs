import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const recipesRoot = path.join(repoRoot, "recipes");

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function readJson(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  try {
    return JSON.parse(readFileSync(fullPath, "utf8"));
  } catch (error) {
    fail(`${relativePath}: invalid JSON (${error.message})`);
    return null;
  }
}

function walkRecipes() {
  const recipes = [];
  for (const domain of readdirSync(recipesRoot)) {
    const domainPath = path.join(recipesRoot, domain);
    if (!statSync(domainPath).isDirectory()) continue;
    for (const name of readdirSync(domainPath)) {
      const recipePath = path.join(domainPath, name);
      if (statSync(recipePath).isDirectory()) recipes.push(`${domain}/${name}`);
    }
  }
  return recipes.sort();
}

const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");

for (const recipe of walkRecipes()) {
  const recipeDir = path.join("recipes", recipe);
  if (!existsSync(path.join(repoRoot, recipeDir, "README.md"))) {
    fail(`${recipe}: missing README.md`);
  }
  if (!existsSync(path.join(repoRoot, recipeDir, "compatibility.json"))) {
    fail(`${recipe}: missing compatibility.json`);
  } else {
    const compatibility = readJson(path.join(recipeDir, "compatibility.json"));
    if (!Array.isArray(compatibility?.templates) || compatibility.templates.length === 0) {
      fail(`${recipe}: compatibility.json must declare at least one template`);
    }
  }
  if (!readme.includes(`\`${recipe}\``)) {
    fail(`${recipe}: missing from root README recipe table`);
  }
}

const agentOpenapi = readJson(
  "recipes/microsoft-copilot/declarative-agent/files/agent/openapi.json",
);
const agentPlugin = readJson("recipes/microsoft-copilot/declarative-agent/files/agent/plugin.json");
const packageScript = readFileSync(
  path.join(
    repoRoot,
    "recipes/microsoft-copilot/declarative-agent/files/scripts/package-agent.sh",
  ),
  "utf8",
);
const declarativeAgentSource = readFileSync(
  path.join(
    repoRoot,
    "recipes/microsoft-copilot/declarative-agent/files/agent/declarativeAgent.json",
  ),
  "utf8",
);

if (agentOpenapi) {
  const paths = Object.keys(agentOpenapi.paths ?? {});
  if (agentOpenapi.openapi !== "3.0.3") {
    fail("Copilot agent OpenAPI must stay on 3.0.3 for broad tool compatibility");
  }
  if (!agentOpenapi.servers?.[0]?.url?.startsWith("https://")) {
    fail("Copilot agent OpenAPI servers[0].url must be an https public host");
  }
  if (paths.length === 0 || paths.some((route) => !route.startsWith("/api/agent/"))) {
    fail("Copilot agent OpenAPI must expose only dedicated /api/agent/* paths");
  }
  for (const [route, operations] of Object.entries(agentOpenapi.paths ?? {})) {
    for (const [method, operation] of Object.entries(operations ?? {})) {
      if (method.toLowerCase() === "get") {
        if (
          operation["x-openai-isConsequential"] !== false ||
          operation["x-oai-isConsequential"] !== false
        ) {
          fail(`${route}: read-only GET must set both non-consequential flags`);
        }
      }
    }
  }
}

if (JSON.stringify(agentPlugin).includes("/api/openapi")) {
  fail("Copilot plugin must not point at the full generated app OpenAPI");
}

if (/teamsapp|m365agents/.test(packageScript)) {
  fail("Copilot package script must use curated packaging, not legacy Teams CLI commands");
}

if (!packageScript.includes("declarativeAgent") || !packageScript.includes("instructions")) {
  fail("Copilot package script must validate declarativeAgent.json and instructions.md placeholders");
}

if (/on[- ]call|Information Security/i.test(declarativeAgentSource)) {
  fail("Copilot declarative agent scaffold must not contain source-app examples");
}

if (process.exitCode) process.exit(process.exitCode);
console.log("Recipe checks passed.");
