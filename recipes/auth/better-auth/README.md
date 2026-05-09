---
title: "auth/better-auth"
type: "Recipe"
status: Active
description: "Wires Better Auth as the auth provider for the cf-fullstack template. Multi-provider env-driven setup: email + password, email-OTP, social OAuth, and Microsoft Entra OIDC all wired; each activates when its env vars are present."
---

# `auth/better-auth`

The default auth provider for `template-cf-fullstack`. Implements the template's `getCurrentUser(request)` abstraction (per [ADR-0007](https://github.com/mwheatfill/template-cf-fullstack/blob/main/docs/adr/0007-auth-provider-abstraction.md)) using Better Auth with the Drizzle adapter.

## Supported templates

`template-cf-fullstack`.

For Cloudflare Access as the alternative auth provider, see [`auth/cloudflare-access`](../cloudflare-access).

## Providers wired

Each provider activates when its env vars are filled in:

- **Email + password** — universal default; activates when `BETTER_AUTH_SECRET` is set.
- **Email-OTP** — passwordless via mailed code (also requires the email recipe to send the OTP).
- **Social OAuth** — Google, GitHub, Apple. Each activates when its `*_CLIENT_ID` and `*_CLIENT_SECRET` are set.
- **Microsoft Entra OIDC** — activates when `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` are set. Optional `MICROSOFT_TENANT_ID` for tenant-scoped flows.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/lib/auth/better-auth-provider.ts` | `createAuth(db)` factory + `getCurrentUserFromAuth(request, auth)` helper. Encapsulates Better Auth-specific setup. |
| `src/lib/auth/get-current-user.ts` | **Replaces the template's null-returning stub.** Implements `getCurrentUser(request)` against this provider. App code reads only from this function; switching to a different auth provider (e.g., installing `auth/cloudflare-access` instead) replaces this file again. |
| `src/lib/db/schema-auth.ts` | Better Auth's required tables (user, session, account, verification). |
| `src/routes/api/auth.$.ts` | TanStack Start API catchall handler that delegates to `auth.handler(request)`. Serves `/api/auth/*`. |
| `src/env-better-auth.d.ts` | Augments `Cloudflare.Env` with the Better Auth env vars. Auto-picked-up by tsconfig. |

## Manual step after install: re-export the schema

The template ships `src/lib/db/schema.ts` with `export {}`. After installing this recipe, add one line so Drizzle picks up the auth tables:

```ts
// src/lib/db/schema.ts
export * from './schema-auth'
```

Then generate and apply migrations:

```bash
pnpm db:generate
pnpm db:migrate:local
```

(For deployed environments: `pnpm db:migrate:prod`.)

## Required configuration

Add to `.dev.vars` (gitignored). For deployed environments use `wrangler secret put`.

| Var | Required | Purpose |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | yes | 32-byte random secret for session signing. Generate with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | recommended | Public URL of your app (e.g. `https://scheduler.example.com`). Used for OAuth redirect URLs and absolute links in emails. |

Add per-provider blocks for whichever providers you want active:

| Provider | Vars |
| --- | --- |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| Apple | `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET` |
| Microsoft (Entra) | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` *(optional, for tenant-scoped flows)* |

Providers without their env vars set are disabled. No vars set besides `BETTER_AUTH_SECRET` means email + password is the only enabled flow.

## What this recipe does NOT handle

- **Group claims for RBAC.** `User.groups` is wired but populated as `[]` by default. To populate from OAuth provider claims, edit `src/lib/auth/better-auth-provider.ts`'s `getCurrentUserFromAuth` to read claim data from the session. Better Auth's organization plugin or custom session hooks handle the deeper RBAC story.
- **Email verification flows.** Better Auth supports email verification but you need to wire a transport (install [`email/send-pipeline`](../../email/send-pipeline) and a transport recipe like [`email/resend`](../../email/resend) or [`email/graph-shared-mailbox`](../../email/graph-shared-mailbox)).
- **OAuth provider app registrations.** You create those in each provider's dashboard. Recipe just wires the keys.

## Pattern

App code reads identity through `getCurrentUser(request)` only. App code does **not** import `better-auth`, `betterAuth`, or `getCurrentUserFromAuth` directly. The abstraction is the boundary; this recipe is one implementation behind it. Swapping to Cloudflare Access (the `auth/cloudflare-access` recipe) replaces the same `get-current-user.ts` file with a different provider implementation, leaves all app code unchanged.

## After install

1. Add `export * from './schema-auth'` to `src/lib/db/schema.ts` (manual; install.sh prints the reminder).
2. Set `BETTER_AUTH_SECRET` in `.dev.vars` (and any provider env vars you want active).
3. `pnpm db:generate && pnpm db:migrate:local`.
4. Verify by visiting `/api/auth/sign-up/email` (POST) or by mounting Better Auth's React client SDK in your UI.
