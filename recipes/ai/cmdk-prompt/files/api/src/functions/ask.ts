import "@apvee/azure-functions-openapi";
import { createAzure } from "@ai-sdk/azure";
import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import { generateText, stepCountIs } from "ai";
import { z } from "zod";

import { AuthError, requirePrincipal } from "../../_shared/auth.js";
import { badRequest, ok, serverError, unauthorized } from "../../_shared/http.js";
import { loadInstructions } from "../lib/agent-instructions.js";
import { buildAgentTools } from "../lib/agent-tools.js";

const AskRequest = z.object({
  message: z.string().min(1).max(2000),
});

const AskResponse = z.object({
  text: z.string(),
  toolCalls: z
    .array(
      z.object({
        name: z.string(),
        input: z.unknown(),
        output: z.unknown(),
      }),
    )
    .optional(),
  finishReason: z.string().optional(),
});

async function ask(req: HttpRequest): Promise<HttpResponseInit> {
  try {
    const principal = requirePrincipal(req);

    const raw = await req.json().catch(() => null);
    const parsed = AskRequest.safeParse(raw);
    if (!parsed.success) {
      return badRequest("Invalid request body", parsed.error.issues);
    }

    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const resourceName = process.env.AZURE_OPENAI_RESOURCE_NAME;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    if (!apiKey || !resourceName || !deployment) {
      return serverError(
        "Azure OpenAI not configured. Set AZURE_OPENAI_API_KEY, AZURE_OPENAI_RESOURCE_NAME, AZURE_OPENAI_DEPLOYMENT in SWA app settings.",
      );
    }

    // Derive base URL from inbound request so internal Function-to-Function calls work.
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const principalHeader = req.headers.get("x-ms-client-principal");

    const azure = createAzure({ apiKey, resourceName });
    const model = azure(deployment);
    const tools = buildAgentTools({ baseUrl, principalHeader });

    const result = await generateText({
      model,
      system: loadInstructions(),
      prompt: parsed.data.message,
      tools,
      stopWhen: stepCountIs(5),
    });

    const toolCalls = result.steps?.flatMap((step) => {
      const calls = step.toolCalls ?? [];
      const results = step.toolResults ?? [];
      return calls.map((call) => ({
        name: call.toolName,
        input: call.input,
        output:
          results.find((r) => r.toolCallId === call.toolCallId)?.output ?? null,
      }));
    });

    return ok({
      text: result.text,
      ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
      finishReason: result.finishReason,
      // identity-tag the response so the SPA can show "answered as Jane Doe" if useful
      _principal: principal.userDetails,
    });
  } catch (e) {
    if (e instanceof AuthError) return unauthorized();
    return serverError("ask failed", e instanceof Error ? e.message : String(e));
  }
}

app.openapiPath("ask", "Natural-language ask the app's agent", {
  handler: ask,
  methods: ["POST"],
  authLevel: "anonymous",
  route: "ask",
  description:
    "Ask the app's agent in natural language. The agent calls API tools as needed and returns a synthesized answer plus the structured tool calls it made.",
  operationId: "ask",
  tags: ["Agent"],
  body: AskRequest,
  responses: [
    { httpCode: 200, schema: AskResponse, description: "Agent's response." },
    { httpCode: 400, description: "Invalid request body." },
    { httpCode: 401, description: "Not signed in." },
    { httpCode: 500, description: "Agent error or misconfiguration." },
  ],
});
