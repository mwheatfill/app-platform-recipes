# `+graph-mail-send`

Adds Microsoft Graph `Mail.Send` from a shared mailbox + React Email templates. Sends
branded HTML emails (Outlook-compatible) using the same Graph client the app already uses
for presence / directory lookup.

## Supported templates

`template-az-spa`, `template-az-fullstack`.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `api/_shared/mail.ts` | `sendMail()` helper using the existing app-only Graph client |
| `api/src/emails/` | Email templates as React components (rendered to HTML at send time) |
| `api/src/emails/components/EmailLayout.tsx` | Shared header/footer/brand wrapper |
| `api/src/emails/Welcome.tsx` | Sample template — copy this for new emails |
| `api/src/functions/send-test-email.ts` | Optional dev endpoint to validate the setup end-to-end (delete after first use) |

## Required configuration

1. **Shared mailbox** — set `SHARED_MAILBOX_ADDRESS` in SWA app settings (e.g.
   `noreply@switchthink.com`). The Graph `Mail.Send` permission lets the app send AS this
   mailbox.
2. **Sender display name** — `MAIL_FROM_NAME` in SWA app settings (e.g. `"On-Call Notifier"`).
3. **Brand colors / logo** in `api/src/emails/components/EmailLayout.tsx` to match your app.

## Required Entra ID permissions

The app's existing Entra registration needs:

- **`Mail.Send`** (Application, admin-consented) — send mail as the configured shared mailbox

Add via the Azure portal or `az ad app permission add` + admin consent. The bootstrap script
prints the consent URL when the app declares Graph scopes.

## After install

```bash
npm install   # picks up @react-email/components and @react-email/render

# From the consuming app, after Graph admin consent is granted:
curl -X POST https://your-app.azurestaticapps.net/api/send-test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "you@example.com"}'

# Once verified, DELETE api/src/functions/send-test-email.ts
```

## Not handled

- **Attachments** — possible via Graph but not in the helper's current API. Add when needed.
- **Bulk sending / mailing lists** — fine for transactional sends (idea assigned, status
  changed, etc.). For >50 recipients per send, consider a dedicated service.
- **Open tracking / click tracking** — out of scope for transactional internal emails.
- **Reply-to / inbound mail handling** — Graph `Mail.Send` is one-way. Inbound webhooks are a
  separate Graph subscription pattern.

## Pattern note

Email templates are React components, not HTML files. You write JSX with Tailwind classes
(via `@react-email/tailwind`); React Email renders to Outlook-compatible HTML at send time.
This keeps email templates in the same language and review process as the rest of the app.
