import { tool } from "ai";
import { z } from "zod";

/**
 * Tool definitions for /api/ask. Each tool describes one operation the LLM can call.
 *
 * Pattern: each tool's `execute` calls a Function via `forward()`, which in turn issues an
 * HTTP request to the local Functions host. The principal header is forwarded so the called
 * Function sees the same user that asked the question.
 *
 * To add a new tool when you add a new endpoint to the API:
 *   1. Add an entry to `buildAgentTools()` below
 *   2. Use the same operationId as the endpoint's OpenAPI metadata
 *   3. Mirror the parameters Zod schema
 *
 * Future enhancement: derive tools automatically from the OpenAPI registry (see notes in
 * the recipe README).
 */

export interface ForwardContext {
  baseUrl: string;
  principalHeader: string | null;
}

async function forward(
  ctx: ForwardContext,
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  path: string,
  init?: { query?: Record<string, string | undefined>; body?: unknown },
): Promise<unknown> {
  let url = `${ctx.baseUrl}/api${path}`;
  if (init?.query) {
    const entries = Object.entries(init.query).filter(
      ([, v]) => v != null && v !== "",
    ) as [string, string][];
    if (entries.length > 0) url += `?${new URLSearchParams(entries).toString()}`;
  }
  const headers: Record<string, string> = {};
  if (ctx.principalHeader) headers["x-ms-client-principal"] = ctx.principalHeader;
  if (init?.body) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { status: res.status, text };
  }
}

export function buildAgentTools(ctx: ForwardContext) {
  return {
    // ---- Example tool — REPLACE_ME with your app's real tools ----
    getHealth: tool({
      description: "Check service health and identify the calling user.",
      inputSchema: z.object({}),
      execute: async () => forward(ctx, "GET", "/health"),
    }),

    // ---- Add your tools here. Pattern: ----
    //
    // operationId: tool({
    //   description: "what this does, in plain English (LLM reads this)",
    //   inputSchema: z.object({
    //     resourceId: z.string().describe("Resource identifier"),
    //     at: z.string().datetime().optional().describe("ISO timestamp; omit for 'right now'"),
    //   }),
    //   execute: async ({ resourceId, at }) =>
    //     forward(ctx, "GET", "/resources/status", { query: { resourceId, at } }),
    // }),
  };
}
