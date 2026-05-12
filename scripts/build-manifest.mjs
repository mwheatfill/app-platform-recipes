#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const recipesRoot = path.join(repoRoot, "recipes");
const manifestPath = path.join(repoRoot, "recipes.json");

const MANIFEST_VERSION = 1;

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function walkRecipes() {
  const out = [];
  for (const domain of readdirSync(recipesRoot).sort()) {
    const domainPath = path.join(recipesRoot, domain);
    if (!statSync(domainPath).isDirectory()) continue;
    for (const name of readdirSync(domainPath).sort()) {
      const recipePath = path.join(domainPath, name);
      if (statSync(recipePath).isDirectory()) out.push({ domain, name, dir: recipePath });
    }
  }
  return out;
}

function extractDescription(readmePath) {
  const raw = readFileSync(readmePath, "utf8");
  const frontmatter = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (frontmatter) {
    const fmDesc = frontmatter[1].match(/^description:\s*(.+)$/m);
    if (fmDesc) {
      const value = fmDesc[1].trim();
      const unquoted = value.replace(/^(['"])(.*)\1$/, "$2");
      return unquoted.trim();
    }
  }
  const body = frontmatter ? raw.slice(frontmatter[0].length) : raw;
  const lines = body.split("\n");
  let sawH1 = false;
  const paragraph = [];
  for (const line of lines) {
    if (!sawH1) {
      if (line.startsWith("# ")) sawH1 = true;
      continue;
    }
    if (line.startsWith("#")) {
      if (paragraph.length) break;
      continue;
    }
    if (line.trim() === "") {
      if (paragraph.length) break;
      continue;
    }
    paragraph.push(line.trim());
  }
  return paragraph.join(" ").trim();
}

function buildManifest() {
  const recipes = [];
  for (const { domain, name, dir } of walkRecipes()) {
    const id = `${domain}/${name}`;
    const compatibilityPath = path.join(dir, "compatibility.json");
    const readmePath = path.join(dir, "README.md");
    const compat = readJson(compatibilityPath);
    recipes.push({
      id,
      domain,
      name,
      description: extractDescription(readmePath),
      templates: compat.templates ?? [],
      ...(compat.implements ? { implements: compat.implements } : {}),
      requires: Array.isArray(compat.requires) ? compat.requires : [],
      dependsOn: Array.isArray(compat.dependsOn) ? compat.dependsOn : [],
      providesEnvVars: Array.isArray(compat.providesEnvVars) ? compat.providesEnvVars : [],
      hasInstallScript: existsSync(path.join(dir, "install.sh")),
      ...(compat.notes ? { notes: compat.notes } : {}),
    });
  }
  return { version: MANIFEST_VERSION, recipes };
}

function serialize(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

const mode = process.argv[2] ?? "write";
if (mode !== "write" && mode !== "check") {
  console.error(`Unknown mode: ${mode}. Use "write" (default) or "check".`);
  process.exit(1);
}

const manifest = buildManifest();
const serialized = serialize(manifest);

if (mode === "check") {
  if (!existsSync(manifestPath)) {
    console.error("recipes.json is missing. Run: pnpm manifest:build");
    process.exit(1);
  }
  const current = readFileSync(manifestPath, "utf8");
  if (current !== serialized) {
    console.error("recipes.json is out of date. Run: pnpm manifest:build");
    process.exit(1);
  }
  console.log("recipes.json is up to date.");
} else {
  writeFileSync(manifestPath, serialized);
  console.log(`Wrote ${manifest.recipes.length} recipes to recipes.json`);
}
