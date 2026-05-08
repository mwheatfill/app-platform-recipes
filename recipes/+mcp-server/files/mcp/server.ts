#!/usr/bin/env node
/**
 * MCP server wrapping the app's REST API as agent tools.
 *
 * Reads the OpenAPI spec at startup and exposes each operation as an MCP tool. New endpoints
 * added to the API show up automatically — restart the MCP client to pick them up.
 *
 * Env vars (set in the MCP client config or a local .env):
 *   API_BASE_URL       base URL of the API (default: http://localhost:7071)
 *   OPENAPI_SPEC_URL   override spec location (default: ${API_BASE_URL}/api/openapi.json)
 *   AGENT_API_KEY      sent as x-agent-key (required for non-localhost typically)
 *   MCP_SERVER_NAME    advertised server name (default: app-platform-mcp)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z, type ZodTypeAny } from "zod";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:7071";
const AGENT_API_KEY = process.env.AGENT_API_KEY;
const SPEC_URL = process.env.OPENAPI_SPEC_URL ?? `${API_BASE_URL}/api/openapi.json`;
const SERVER_NAME = process.env.MCP_SERVER_NAME ?? "app-platform-mcp";

interface Operation {
  toolName: string;
  description: string;
  method: string;
  pathTemplate: string;
  pathParams: string[];
  queryParams: { name: string; required: boolean; description?: string }[];
  hasBody: boolean;
}

function authHeaders(): Record<string, string> {
  return AGENT_API_KEY ? { "x-agent-key": AGENT_API_KEY } : {};
}

async function loadOperations(): Promise<Operation[]> {
  const res = await fetch(SPEC_URL, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(
      `Cannot fetch OpenAPI spec at ${SPEC_URL}: ${res.status} ${res.statusText}`,
    );
  }
  // biome-ignore lint/suspicious/noExplicitAny: parsing untyped OpenAPI JSON
  const spec = (await res.json()) as any;
  const ops: Operation[] = [];
  for (const [pathTemplate, pathItem] of Object.entries(spec.paths ?? {})) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const method of ["get", "post", "put", "delete", "patch"] as const) {
      // biome-ignore lint/suspicious/noExplicitAny: untyped OpenAPI traversal
      const op = (pathItem as any)[method];
      if (!op) continue;
      // biome-ignore lint/suspicious/noExplicitAny: untyped OpenAPI traversal
      const params = (op.parameters ?? []) as any[];
      const pathParams = params.filter((p) => p.in === "path").map((p) => p.name as string);
      const queryParams = params
        .filter((p) => p.in === "query")
        .map((p) => ({
          name: p.name as string,
          required: !!p.required,
          description: p.description as string | undefined,
        }));
      ops.push({
        toolName: op.operationId ?? `${method}_${pathTemplate.replace(/[/{}]/g, "_")}`,
        description: op.description ?? op.summary ?? `${method.toUpperCase()} ${pathTemplate}`,
        method: method.toUpperCase(),
        pathTemplate,
        pathParams,
        queryParams,
        hasBody: !!op.requestBody,
      });
    }
  }
  return ops;
}

function buildInputShape(op: Operation): Record<string, ZodTypeAny> {
  const shape: Record<string, ZodTypeAny> = {};
  if (op.pathParams.length > 0) {
    shape.path = z
      .object(Object.fromEntries(op.pathParams.map((n) => [n, z.string()])))
      .describe("Path parameters");
  }
  if (op.queryParams.length > 0) {
    shape.query = z
      .object(
        Object.fromEntries(
          op.queryParams.map((q) => {
            const base = z.string();
            return [q.name, q.required ? base : base.optional()];
          }),
        ),
      )
      .describe("Query parameters");
  }
  if (op.hasBody) {
    shape.body = z.record(z.unknown()).describe("Request body (JSON)");
  }
  return shape;
}

function buildUrl(
  op: Operation,
  args: { path?: Record<string, string>; query?: Record<string, string> },
): string {
  let path = op.pathTemplate;
  for (const name of op.pathParams) {
    const v = args.path?.[name];
    if (v == null) throw new Error(`Missing path param: ${name}`);
    path = path.replaceAll(`{${name}}`, encodeURIComponent(v));
  }
  let url = `${API_BASE_URL}/api${path}`;
  if (args.query) {
    const filtered = Object.entries(args.query).filter(
      ([, v]) => v != null && v !== "",
    ) as [string, string][];
    if (filtered.length > 0) {
      url += `?${new URLSearchParams(filtered).toString()}`;
    }
  }
  return url;
}

async function main() {
  const operations = await loadOperations();
  const server = new McpServer({ name: SERVER_NAME, version: "0.1.0" });

  for (const op of operations) {
    server.registerTool(
      op.toolName,
      {
        description: op.description,
        inputSchema: buildInputShape(op),
      },
      // biome-ignore lint/suspicious/noExplicitAny: MCP handler args are dynamic
      async (args: any) => {
        const url = buildUrl(op, args);
        const init: RequestInit = {
          method: op.method,
          headers: {
            ...authHeaders(),
            ...(args.body ? { "Content-Type": "application/json" } : {}),
          },
          ...(args.body ? { body: JSON.stringify(args.body) } : {}),
        };
        const res = await fetch(url, init);
        const text = await res.text();
        return {
          content: [
            {
              type: "text" as const,
              text: `${res.status} ${res.statusText}\n\n${text}`,
            },
          ],
        };
      },
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[${SERVER_NAME}] connected via stdio. ${operations.length} tools loaded from ${SPEC_URL}`,
  );
}

main().catch((err) => {
  console.error("[mcp] fatal:", err);
  process.exit(1);
});
