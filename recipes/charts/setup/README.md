---
title: "charts/setup"
type: "Recipe"
status: Active
description: "Adds shadcn Chart (Recharts v3 wrapper) and an example /charts route showing area + bar with tooltip."
---

# `charts/setup`

shadcn Chart plus a working example at `/charts` (area + bar side by side, fed via `createServerFn` + `queryOptions` + `useSuspenseQuery`).

## Supported templates

`template-cf-fullstack`.

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/components/ui/chart.tsx` | shadcn Chart primitives (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `ChartConfig`). Installed by `npx shadcn@latest add chart`. |
| `src/routes/charts.tsx` | Example route at `/charts`, matching the data pattern in `src/routes/index.tsx`. |

## After install

1. `pnpm dev`, open `http://localhost:5173/charts`. Verify both charts render in light and dark mode.
2. Replace the static data in `getChartData()` (`src/routes/charts.tsx`) with your real source (D1 via Drizzle, external API, etc.). The `queryOptions` + `useSuspenseQuery` shape stays the same.
3. Keep `/charts` as a reference or delete it.

## Pattern

Import primitives from `@/components/ui/chart`. Define a `chartConfig` object (one entry per series, with `label` and `color`) and pass it to `<ChartContainer>`. Compose Recharts components (`AreaChart`, `BarChart`, `Bar`, `Area`, `XAxis`, `CartesianGrid`) inside.

Colors come from CSS variables: `var(--color-<key>)`. No `hsl()` wrapper, no hex literals.

## What this recipe does NOT handle

- **Custom palettes.** Edit `--chart-1` through `--chart-5` in `src/styles/app.css`.
- **Real data sources.** Wire your own server function.
- **Other Recharts types** (treemap, scatter, sankey, radar, radial). Same `<ChartContainer>` + `chartConfig` pattern; add to the example route or your own routes.
- **Dashboard composition.** That's `dashboard/scaffold` (planned).
