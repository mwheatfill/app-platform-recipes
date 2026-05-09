---
title: "email/welcome-template"
type: "Recipe"
status: Active
description: "Example React Email template demonstrating the pattern. Copy and modify, or use as a reference for your own templates."
---

# `email/welcome-template`

A minimal React Email template (`WelcomeEmail`) that demonstrates the pattern: typed props, inline styles for email-client compatibility, and `PreviewProps` so the template renders in the `email:dev` preview server with sample data.

## Supported templates

`template-cf-fullstack`.

## Dependencies

- [`email/send-pipeline`](../send-pipeline) for the `sendEmail` dispatcher and the `email:dev` preview server.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/lib/email/templates/welcome.tsx` | `WelcomeEmail({ name, appName, appUrl })` React Email component. Includes `PreviewProps` for `email:dev`. |

## Why inline styles

Email clients (especially Outlook) don't reliably support external stylesheets, modern CSS, or class-based styling. React Email's convention is to pass `style` objects directly to elements. The template demonstrates this; copy the pattern for your own templates.

## After install

```bash
pnpm email:dev
# Open http://localhost:3001 to preview the template with sample data.
```

To send:

```ts
import { sendEmail } from '@/lib/email/send'
import { WelcomeEmail } from '@/lib/email/templates/welcome'

await sendEmail({
  to: 'user@example.com',
  from: 'noreply@example.com',
  subject: 'Welcome',
  template: <WelcomeEmail name="Alex" appName="My App" appUrl="https://example.com" />,
})
```

(Requires a transport recipe installed to actually deliver.)
