# Durable Snapshot Cache

Use this when upstream calls are slow, flaky, expensive, rate-limited, or too slow for Copilot
and plugin user paths. The refresh path does the slow work; user-path reads project durable
snapshots.

## Supported templates

`template-az-spa`, `template-az-fullstack`.

## What to add

| Path | Purpose |
| --- | --- |
| `api/src/functions/snapshot-status.ts` | Authenticated status/diagnostic endpoint |
| `api/src/functions/internal-refresh-<model>.ts` | Refresh endpoint protected by `x-refresh-key` |
| `api/src/lib/snapshots.ts` | Blob read/write helpers and freshness semantics |
| `.github/workflows/refresh-<model>.yml` | Scheduled caller for SWA Free |
| `docs/snapshots.md` | Runbook: storage, freshness, fallback, rotation |

This recipe is guidance-first because snapshot names, schemas, and upstream calls are app
specific. Copy the pattern, not a domain model.

## Environment

| Var | Purpose |
| --- | --- |
| `SNAPSHOT_BLOB_URL` | Private blob URL with read SAS for API reads |
| `SNAPSHOT_BLOB_WRITE_URL` | Private blob URL with write SAS for refresh writes |
| `REFRESH_KEY` | Random secret required by scheduled refresh calls |

On SWA Free, managed identity is not available for managed Functions. A scoped SAS or storage
connection string in SWA app settings is the pragmatic Tier 1 choice. Use Key Vault references
after upgrading to SWA Standard with managed identity.

## Pattern

```text
scheduled workflow -> POST /api/internal/refresh/<model> -> slow upstreams -> blob snapshot
React/Copilot/API -> GET /api/<model> or /api/agent/<action> -> project snapshot
```

Snapshot metadata should include:

```json
{
  "schemaVersion": 1,
  "fetchedAt": "2026-05-08T18:45:00Z",
  "expiresAt": "2026-05-08T18:50:00Z",
  "source": {
    "systemA": "success",
    "systemB": "partial"
  },
  "errors": [],
  "data": {}
}
```

## Cache semantics

- Fresh snapshot: return it.
- Stale snapshot: return it with `stale: true` and visible freshness metadata.
- Missing snapshot: return a setup error or run one guarded blocking refresh if that is safe.
- Out-of-range query: return a clear fallback/error; do not make normal user requests perform
  surprise multi-hop work.

If snapshots are projected through a public agent endpoint, document the data boundary. Prefer
opaque IDs and app-hosted avatar URLs over raw upstream URLs or broad personal data.

## Deploy steps

1. Create the storage account/container and private blob.
2. Generate read/write SAS values with expiry dates visible in the runbook.
3. Add `SNAPSHOT_BLOB_URL`, `SNAPSHOT_BLOB_WRITE_URL`, and `REFRESH_KEY` as SWA app settings.
4. Add a scheduled GitHub workflow that calls the refresh endpoint with `x-refresh-key`.
5. Add authenticated status/freshness endpoints and a human-readable health view.
6. Add contract tests for route auth, refresh-key enforcement, missing snapshot behavior, and
   stale snapshot behavior.

## Verification

```bash
curl -i https://app.example.com/api/snapshot/status
curl -i -X POST https://app.example.com/api/internal/refresh/example \
  -H "x-refresh-key: $REFRESH_KEY"
curl -i https://app.example.com/api/agent/example
```

Check App Insights for refresh duration, upstream failures, stale reads, and public agent
requests.

## Common failure modes

- Refresh workflow secret does not match SWA app setting.
- SAS expired or grants write without read, or read without write.
- User-path endpoint falls back to slow upstream calls and times out under Copilot.
- Snapshot schema changes without versioning or projection tests.
- Public projections expose data that was safe only behind EasyAuth.

## Rollback

Disable the scheduled workflow, remove any public projection route exceptions, and keep the last
known-good blob for inspection. Rotate SAS values if a public endpoint exposed the wrong data.
