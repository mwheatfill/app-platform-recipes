import { readFileSync } from "node:fs";
import { join } from "node:path";

let cached: string | null = null;
const FALLBACK =
  "You are a helpful assistant. Use the available tools to answer questions about this app's data. Don't speculate about data the tools didn't return.";

/**
 * Load the agent's system prompt from agent/instructions.md.
 *
 * The file is shared between this Function and the +copilot-agent recipe — one edit,
 * both surfaces update. Cached after first read.
 */
export function loadInstructions(): string {
  if (cached) return cached;

  // The Function runs from api/dist/src/functions/, so go up to the repo root.
  const candidates = [
    join(process.cwd(), "..", "agent", "instructions.md"),
    join(process.cwd(), "..", "..", "agent", "instructions.md"),
    join(process.cwd(), "agent", "instructions.md"),
  ];

  for (const path of candidates) {
    try {
      cached = readFileSync(path, "utf-8");
      return cached;
    } catch {
      // try next candidate
    }
  }

  cached = FALLBACK;
  return cached;
}
