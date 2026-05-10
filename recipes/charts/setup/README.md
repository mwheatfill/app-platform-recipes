---
title: "charts/setup"
type: "Recipe"
status: Active
description: "Adds shadcn Chart (Recharts v3 wrapper) and an example /charts route showing area + bar with tooltip."
---

# `charts/setup`

[shadcn Chart](https://ui.shadcn.com/docs/components/chart) (Recharts v3 wrapper) plus a working example at `/charts`. shadcn Chart vendors a small set of typed primitives into `src/components/ui/chart.tsx`; Recharts is the rendering engine underneath.

Why shadcn Chart over Chart.js / Victory / Plotly / Nivo / ECharts: see [ADR-008: UI / visual layer](https://github.com/mwheatfill/template-cf-fullstack/blob/main/docs/adr/008-ui-visual-layer.md).

## Supported templates

`template-cf-fullstack`.

## Install

```bash
# from the consuming app's repo root
curl -sSL https://raw.githubusercontent.com/mwheatfill/app-platform-recipes/main/install.sh | \
  bash -s -- charts/setup
```

See the [top-level README](https://github.com/mwheatfill/app-platform-recipes#install-a-recipe) for the installer mechanism (compatibility checking, idempotent copy, etc.).

## What this recipe adds

| Path | Purpose |
| --- | --- |
| `src/components/ui/chart.tsx` | shadcn Chart primitives (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `ChartConfig`). Installed by `npx shadcn@latest add chart`. |
| `src/routes/charts.tsx` | Example route at `/charts`. Server function via `createServerFn`, declared as `queryOptions`, hydrated by the route loader (`context.queryClient.ensureQueryData`), consumed in the component with `useSuspenseQuery`. |

## After install

1. `pnpm dev`, open `http://localhost:5173/charts`. Verify both charts render in light and dark mode.
2. Replace the static data in `getChartData()` (`src/routes/charts.tsx`) with your real source (D1 via Drizzle, external API, etc.). The `queryOptions` + `useSuspenseQuery` shape stays the same.
3. Keep `/charts` as a reference or delete it.

## Pattern

Import primitives from `@/components/ui/chart`. Define a `chartConfig` object (one entry per series, each with `label` and `color`) and pass it to `<ChartContainer>`. The container exposes one CSS variable per config key: the `desktop` entry becomes `var(--color-desktop)`, used on Recharts `fill` and `stroke` props.

```tsx
const chartConfig = {
  visitors: { label: 'Visitors', color: 'var(--chart-1)' },
} satisfies ChartConfig

<ChartContainer config={chartConfig}>
  <AreaChart data={data}>
    <Area dataKey="visitors" fill="var(--color-visitors)" stroke="var(--color-visitors)" />
    <ChartTooltip content={<ChartTooltipContent />} />
  </AreaChart>
</ChartContainer>
```

Colors flow through CSS variables only; no `hsl()` wrapper, no hex literals.

## What this recipe does NOT handle

- **Custom palettes.** Edit `--chart-1` through `--chart-5` in `src/styles/app.css`.
- **Real data sources.** Wire your own server function.
- **Other Recharts types** (treemap, scatter, sankey, radar, radial). Same `<ChartContainer>` + `chartConfig` pattern; add to the example route or your own routes.
- **Dashboard composition.** That's `dashboard/scaffold` (planned).
