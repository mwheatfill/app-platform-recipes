# `auth/cloudflare-access`

Cloudflare Access as the auth provider for `template-cf-fullstack`. Implements the template's `getCurrentUser(request)` abstraction ([ADR-005](https://github.com/mwheatfill/template-cf-fullstack/blob/main/docs/adr/005-auth-provider-abstraction.md)) by validating the `Cf-Access-Jwt-Assertion` header that Access adds to every request.

Use this recipe when Cloudflare Access (with your identity provider behind it) is fronting the app. For self-managed user accounts and social OAuth, install [`auth/better-auth`](../better-auth) instead.

## Supported templates

`template-cf-fullstack`.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/lib/auth/cloudflare-access-provider.ts` | JWT validation via `jose` against the team's JWKS endpoint. Maps claims to the canonical `User` shape. |
| `src/lib/auth/get-current-user.ts` | **Replaces the template's null-returning stub.** Routes requests through the provider, with an env-driven dev-mode bypass for local work without Access in front. |
| `src/env-cloudflare-access.d.ts` | Augments `Cloudflare.Env` with `TEAM_DOMAIN`, `POLICY_AUD`, `DEV_AUTH_BYPASS_USER`. |

The recipe adds `jose` as a dependency (Cloudflare's canonical JWT library for Workers; works against the Web Crypto API natively).

## How it works

Cloudflare Access authenticates the user via your IdP, signs a JWT with a key from the team's keypair, and attaches it to the request as `Cf-Access-Jwt-Assertion`. The provider:

1. Reads the token from the header (returns `null` if missing).
2. Verifies it against `<TEAM_DOMAIN>/cdn-cgi/access/certs` (the JWKS endpoint Cloudflare publishes for your team) using `jose`'s `createRemoteJWKSet` + `jwtVerify`, with `issuer: TEAM_DOMAIN` and `audience: POLICY_AUD`.
3. Maps the verified claims to the canonical `User` shape: `sub` (or `email` if sub is empty) → `id`, `email`, optional `name` / `picture`, and `groups` from the array claim.

Source: [Cloudflare Access — Validate JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

## Required configuration

Add to `.dev.vars` (gitignored). For deployed environments use `wrangler secret put` for `POLICY_AUD` and `vars` block in `wrangler.jsonc` for `TEAM_DOMAIN`.

| Var | Required | Purpose |
| --- | --- | --- |
| `TEAM_DOMAIN` | yes | `https://<your-team-name>.cloudflareaccess.com`. Both the JWKS host and the expected JWT issuer. |
| `POLICY_AUD` | yes | Application Audience (AUD) Tag from the Access application's Additional settings. |
| `DEV_AUTH_BYPASS_USER` | no | JSON-serialized `User` for local dev. When set, the JWT path is skipped entirely. |

Get `POLICY_AUD` from: Cloudflare dashboard → Zero Trust → Access controls → Applications → your app → Configure → Additional settings → Application Audience (AUD) Tag.

## Dev-mode bypass

`pnpm dev` runs the Worker without Cloudflare Access in front, so no JWT is attached and `getCurrentUser` would return `null` for every request. Set `DEV_AUTH_BYPASS_USER` in `.dev.vars` to a JSON-serialized `User`:

```
DEV_AUTH_BYPASS_USER={"id":"dev","email":"me@example.com","name":"Local Dev","groups":["App-Admins"]}
```

Each developer can set distinct ids and group sets to test RBAC paths locally. The bypass is gated only by env presence; `wrangler secret` and the production `vars` block should never carry `DEV_AUTH_BYPASS_USER`.

## Group claims

The provider reads `payload.groups` as a `string[]`. Whether the JWT contains a `groups` claim depends on your IdP mapping:

- **Entra OIDC**: configure a group claim in the Entra app registration, then in Cloudflare Access map it to a `groups` claim on the JWT.
- **Other IdPs**: similar mapping at the IdP side, then surface via Access.

If your setup uses a different claim name (e.g. `cf-access-groups`, `custom:groups`), edit `src/lib/auth/cloudflare-access-provider.ts` to read the right key. A future `entra/group-claim-extraction` recipe will codify the Entra-specific path.

## What this recipe does NOT handle

- **The Access application itself.** You create the Access application in the Cloudflare dashboard (or via Terraform). The recipe just consumes the JWT it produces.
- **IdP setup.** Entra / Okta / etc. live behind Access. Set those up first per Cloudflare's [IdP integrations](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/).
- **Group → role mapping.** The provider hands you `groups: string[]`. App-level RBAC (e.g. "if `groups` includes `App-WebScheduler-Admins`, grant admin") is app code.
- **Service tokens.** Cloudflare Access service tokens issue JWTs with an empty `sub`. The provider falls back to `email` for the id, but service-token traffic typically wants a separate guard rather than going through `getCurrentUser`.

## Pattern

App code reads identity through `getCurrentUser(request)` only. App code does **not** import `jose` or read the `Cf-Access-Jwt-Assertion` header directly. The abstraction is the boundary; this recipe is one implementation behind it. Swapping to `auth/better-auth` replaces the same `get-current-user.ts` file with a different provider, leaving all app code unchanged.

## After install

1. Set `TEAM_DOMAIN` and `POLICY_AUD` in `.dev.vars`.
2. For local dev: set `DEV_AUTH_BYPASS_USER` to a JSON-serialized `User`.
3. For deployed environments: add `TEAM_DOMAIN` to `wrangler.jsonc` `vars` and `wrangler secret put POLICY_AUD`.
4. Create the Cloudflare Access application bound to your app's domain, add an Allow policy with your IdP.
5. Verify by hitting an auth-gated route: `getCurrentUser(request)` should return the authenticated user.
