# Card-Ready Responses

Use this when the same API response should support React cards, Microsoft 365 Copilot Adaptive
Card citations, or other host-rendered summaries.

## Supported templates

`template-az-spa`, `template-az-fullstack`, `template-cf-fullstack`.

## Response shape

Keep the conversational answer and card data side by side:

```json
{
  "answer": "Alice is primary and Bob is secondary for the Network team.",
  "peopleCards": [
    {
      "title": "Alice",
      "subtitle": "Primary - Network",
      "email": "alice@example.com",
      "avatarUrl": "https://app.example.com/api/avatar/alice",
      "detail": "May 5-12",
      "status": "Available"
    }
  ],
  "items": []
}
```

Rules:

- Keep card items flat. Avoid nested operational objects in the card array.
- Keep counts bounded. Cards are summaries, not directory exports.
- Make fields display-ready: `title`, `subtitle`, `detail`, `status`, `avatarUrl`.
- Include a complete `answer`; do not rely on a host model to reconstruct facts from compact
  arrays.
- Use app-hosted avatar/image URLs when data crosses public or agent boundaries.

## Adaptive Cards vs native people cards

Adaptive Card response templates can make Copilot citations richer. They do not become native
Microsoft 365 people cards. Microsoft controls native profile surfaces, placement, presence
badges, org-chart sections, and chat/call chrome.

Design for conservative host rendering:

- Single column or a small avatar/text row.
- No fixed widths.
- No `Action.OpenUrl` buttons until validated in the target host.
- One static template per action until the response shape is stable.

## Files changed

This is usually a schema and tests change, not a scaffolding copy:

| Path | Change |
| --- | --- |
| `api/src/functions/<action>.ts` | Return `answer` plus flat card arrays |
| `api/src/lib/<model>.ts` | Project upstream data into display-ready fields |
| `agent/openapi.json` | Document the bounded response schema |
| `agent/plugin.json` | Bind response semantics to `$.peopleCards` or another flat array |
| `test/*contract*.test.ts` | Prevent response broadening or nested card regressions |

## Verification

- Unit-test the projection from domain data to card data.
- Contract-test max card counts and required display fields.
- In Copilot, verify the text answer and cards carry the same facts.
- In React, render long names, missing avatars, and narrow mobile widths.

## Common failure modes

- The text answer mentions only one item while cards include several.
- Card arrays contain nested source objects or raw upstream API payloads.
- The app promises native Microsoft 365 people-card behavior it cannot control.
- Public card payloads include data that was safe only behind authenticated app routes.

## Rollback

Keep the original operational response fields until callers migrate. Add card fields alongside
existing fields, then remove old fields only after client and agent contracts are updated.
