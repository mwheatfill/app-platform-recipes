# Smooth SWA Auth UX

Use this for Azure Static Web Apps React SPAs that should feel like polished internal products
while still relying on SWA EasyAuth and Microsoft Entra ID.

## Supported templates

`template-az-spa`.

## What to change

| Path | Change |
| --- | --- |
| `staticwebapp.config.json` | Public `/` and `/login`; protected `/api/*`; no blanket 401 redirect override |
| `src/routes/__root.tsx` | Root auth guard calls `/.auth/me` before protected loaders |
| `src/routes/login.tsx` | Branded sign-in page that builds the EasyAuth URL |
| `src/lib/principal.ts` | Zod-validated `/.auth/me` parser and safe redirect helper |
| `e2e/*.spec.ts` | Smoke coverage for unsigned redirect and login URL |

Current `template-az-spa` already includes this pattern. Use the recipe when upgrading older
apps or other SWA SPAs.

## SWA route shape

```json
{
  "routes": [
    { "route": "/logout", "redirect": "/.auth/logout" },
    { "route": "/login", "allowedRoles": ["anonymous", "authenticated"] },
    { "route": "/api/*", "allowedRoles": ["authenticated"] },
    { "route": "/*", "allowedRoles": ["anonymous", "authenticated"] }
  ]
}
```

Avoid using a blanket `responseOverrides.401.redirect` as the primary SPA login UX. It is fine
for fully protected static sites, but React apps get a cleaner first paint when the SPA owns the
login surface.

## Login URL

Build the EasyAuth URL with a same-origin redirect:

```text
/.auth/login/aad?post_login_redirect_uri=https%3A%2F%2Fapp.example.com%2Ftarget
```

Sanitize redirect inputs. Accept only app-relative paths, reject `//evil.example`, and never
redirect into `/.auth/*`.

## Local development

- `npm run dev`: fast SPA work, auth-free.
- `npm run dev:swa`: SWA CLI + Functions + routing + auth-like behavior.

Use `dev:swa` before changing route config, Function auth, login/logout, or anything that
depends on EasyAuth headers.

## Verification

With no cookies:

```bash
curl -I https://app.example.com/
curl -I https://app.example.com/login
curl -I https://app.example.com/api/health
```

Expect `/` and `/login` to return the SPA shell and `/api/health` to require auth unless it is
explicitly documented as public.

Browser smoke:

1. Open a protected app route.
2. See the branded `/login` page.
3. Click "Continue with Microsoft".
4. Authenticate once with Entra.
5. Return to the original route.

## Common failure modes

- `/login` redirects directly to `/.auth/login/aad`, so branding never appears.
- `/*` is protected by SWA, so React cannot show its own login route.
- Route loaders call `/api/*` before the root auth guard resolves.
- `post_login_redirect_uri` is missing or accepts unsafe external URLs.
- Local `dev` tests pass, but `dev:swa` reveals missing EasyAuth principal handling.

## Rollback

Restore the previous `staticwebapp.config.json` and remove the React guard/login route. Keep in
mind that returning to platform-owned redirects usually makes first-run UX rougher.
