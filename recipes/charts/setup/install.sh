#!/usr/bin/env bash
set -euo pipefail

echo "▶ Installing shadcn Chart component (Recharts v3 wrapper)..."
echo ""
pnpm dlx shadcn@latest add chart

echo ""
echo "▶ Manual steps remaining:"
echo ""
echo "  1. Run 'pnpm dev' and visit http://localhost:5173/charts to verify"
echo "     the example route renders area + bar charts in light and dark mode."
echo ""
echo "  2. Replace the static data in getChartData() inside src/routes/charts.tsx"
echo "     with your real data source (D1 via Drizzle, external API, etc.)."
echo "     The queryOptions + useSuspenseQuery shape stays the same."
echo ""
echo "  3. Either keep /charts as a working reference or delete the file once"
echo "     you have your own chart routes."
echo ""
