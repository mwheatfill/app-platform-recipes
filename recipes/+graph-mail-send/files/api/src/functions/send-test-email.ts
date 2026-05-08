import { registerFunction } from "@apvee/azure-functions-openapi";
import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import { render } from "@react-email/render";
import { z } from "zod";

import { AuthError, requirePrincipal } from "../../_shared/auth.js";
import { sendMail } from "../../_shared/mail.js";
import { badRequest, ok, serverError, unauthorized } from "../../_shared/http.js";
import { WelcomeEmail } from "../emails/Welcome.js";

/**
 * DEV-ONLY validation endpoint. Sends a sample email using the WelcomeEmail template.
 *
 * Delete this file after you've verified Mail.Send works end-to-end. Production apps should
 * have purpose-built send Functions, not a generic test endpoint.
 */

const SendTestEmailRequest = z.object({
  to: z.string().email(),
});

const SendTestEmailResponse = z.object({
  status: z.literal("sent"),
  to: z.string(),
});

async function sendTestEmail(req: HttpRequest): Promise<HttpResponseInit> {
  try {
    const principal = requirePrincipal(req);
    const raw = await req.json().catch(() => null);
    const parsed = SendTestEmailRequest.safeParse(raw);
    if (!parsed.success) return badRequest("Invalid request", parsed.error.issues);

    const html = await render(
      WelcomeEmail({
        recipientName: principal.userDetails ?? "there",
        appName: process.env.APP_NAME ?? "REPLACE_ME",
        appUrl: process.env.APP_URL ?? "https://example.com",
      }),
    );

    await sendMail({
      to: parsed.data.to,
      subject: `[test] Welcome to ${process.env.APP_NAME ?? "REPLACE_ME"}`,
      html,
    });

    return ok({ status: "sent" as const, to: parsed.data.to });
  } catch (e) {
    if (e instanceof AuthError) return unauthorized();
    return serverError("send-test-email failed", e instanceof Error ? e.message : String(e));
  }
}

registerFunction("send-test-email", "Send a test email (DEV)", {
  handler: sendTestEmail,
  methods: ["POST"],
  authLevel: "anonymous",
  azureFunctionRoutePrefix: "api",
  route: "send-test-email",
  description:
    "Validates the Mail.Send setup by sending a sample WelcomeEmail to the requested address. Delete this Function after first successful test — production apps should have purpose-built send endpoints.",
  operationId: "sendTestEmail",
  tags: ["Mail", "Dev"],
  request: {
    body: {
      content: { "application/json": { schema: SendTestEmailRequest } },
      required: true,
    },
  },
  responses: {
    "200": {
      description: "Email sent.",
      content: { "application/json": { schema: SendTestEmailResponse } },
    },
    "400": { description: "Invalid request." },
    "401": { description: "Not signed in." },
    "500": { description: "Send failed (often a permissions issue)." },
  },
});
