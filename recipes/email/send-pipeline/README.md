---
title: "email/send-pipeline"
type: "Recipe"
status: Active
description: "sendEmail(input) dispatcher with React Email render layer. Transport-pluggable; throws clear install-the-X-recipe errors until a transport is installed."
---

# `email/send-pipeline`

`sendEmail(input)` function that renders React Email templates and dispatches to a transport based on `EMAIL_TRANSPORT` env. Throws a clear "install the X recipe" error if `EMAIL_TRANSPORT` is unset or its transport recipe isn't installed.

## Supported templates

`template-cf-fullstack`.

## Companion recipes

Install one transport recipe to enable actual sending:

- [`email/graph-shared-mailbox`](../graph-shared-mailbox) — Microsoft Graph from a shared mailbox (default for internal apps)
- [`email/resend`](../resend) — Resend transactional API
- [`email/cloudflare-email-service`](../cloudflare-email-service) — Cloudflare Email Service public beta

For a starter template, install [`email/welcome-template`](../welcome-template).

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/lib/email/send.ts` | `sendEmail(input)` dispatcher. Renders the template to HTML + plaintext via `react-email`, then routes to the configured transport. |
| `src/env-email.d.ts` | Augments `Cloudflare.Env` with `EMAIL_TRANSPORT`. |

Transport recipes ship their own provider modules (`sendViaResend`, `sendViaGraph`, etc.) that this dispatcher imports.

## Required configuration

Add to `.dev.vars` once a transport recipe is installed:

```
EMAIL_TRANSPORT=resend  # or graph, cloudflare-email
```

The transport recipe documents its own env vars (`RESEND_API_KEY`, `GRAPH_*`, etc.).

## Adds the email:dev preview script

Adds `pnpm email:dev` (port 3001) for local preview of React Email templates. Run while developing templates to see live changes.

## What this recipe does NOT handle

- **Inbound email.** Use [`email/cloudflare-email-routing`](../cloudflare-email-routing) for receiving mail at custom domains.
- **Email validation, bounce handling, suppression lists.** Transport-specific concerns; each transport recipe documents what it provides.
- **Templates themselves.** Bring your own React Email components, or install [`email/welcome-template`](../welcome-template) for an example.

## After install

1. Install a transport recipe (`email/resend`, `email/graph-shared-mailbox`, or `email/cloudflare-email-service`).
2. Set `EMAIL_TRANSPORT` and the transport-specific env vars in `.dev.vars`.
3. Optionally install `email/welcome-template`.
4. Call `sendEmail({ to, from, subject, template: <YourEmail {...props} /> })` from a server function.
