# journedge conventions

Trading journal. Next.js 16 App Router on a single route, Prisma + SQLite.
Read `REPO_MAP.md` first for the file list; this file is the rules.

## Non-negotiables

- **All trading math lives in `app/lib/analytics.ts`.** The Analytics page and
  the PDF report both read it so the two can never disagree. Never recompute a
  ratio, drawdown or R-multiple inside a page or component.
- **Recommendations live in `app/lib/insights.ts` and stay pure.** Thresholds sit
  in the single `T` block; a new rule reads them from there rather than
  hardcoding a number inline.
- **Every finding names the figure it fired on.** `Insight.metric` carries the
  number so a trader can check it against the chart. A rule that only restates a
  metric is not a recommendation.
- **`JOURNEDGE_HEADER` in the exporter must match `JOURNEDGE_COLUMNS` in
  `parseMetaTraderCSV.ts`.** Changing one alone breaks import silently — the
  column count still parses and the rows shift.
- **Findings are ranked worst-first** and panels cap at 6 (8 on Process), stating
  how many are hidden rather than dropping them.
- **Small sample leads.** Under 30 trades every section is prefixed with the
  provisional caveat; do not bury it at the bottom.

## Layout

- `app/lib/` is the only place domain logic goes. Pages render, they do not
  analyse.
- `app/pages/` one file per `PageId`. Adding a page touches three places:
  the `PageId` union in `types.ts`, `NAV_ITEMS` in `Sidebar.tsx`, and the
  conditional map in `app/page.tsx`.
- `app/api/*/route.ts` owns serialisation, including the JSON-in-TEXT columns.
  Stringify there, `JSON.parse` on the client — never the reverse.
- `app/components/` holds shared presentational pieces only. `InsightPanel`,
  `SectionCard` and `MetricCard` in `AnalyticsCards.tsx` are the primitives for
  anything Analytics-shaped.
- `scripts/` holds the MetaTrader exporter and the changelog CLI. Neither is
  app code and neither is imported by the app.

## Settings

`useSettings()` is localStorage-backed and merged over `DEFAULTS` on load, so a
new key only needs a field plus a default. `showRecommendations` gates the
Analytics panels — it hides the reading, never the numbers.

## Migration & data

- `npx prisma migrate dev` is manual. There is no seed script; do not assume one
  exists when a database looks empty.
- `prisma/journedge.db` is a local SQLite file. Never read it.
- The in-app updater (`app/api/update/route.ts`) backs up the db before
  migrating and prunes to the 5 most recent. Keep that ordering intact.

## Verify

- `npx` is blocked by the PowerShell execution policy on this machine. Call the
  binaries directly:
  - typecheck: `& "$env:ProgramFiles\nodejs\node.exe" ".\node_modules\typescript\bin\tsc" --noEmit`
  - lint one file: `& "$env:ProgramFiles\nodejs\node.exe" ".\node_modules\eslint\bin\eslint.js" <file>`
  - build: `& "$env:ProgramFiles\nodejs\node.exe" ".\node_modules\next\dist\bin\next" build`
- The build prints a Node `DEP0205` deprecation warning on stderr. That is noise;
  judge success from `Compiled successfully` and `✓ Generating static pages`.
- `npm run lint` already fails on pre-existing errors in `JournalToolbar`,
  `Sidebar`, `TradePanel` and `PropFirmPanel`. Lint your own files and report
  those separately; do not claim the tree is clean.
- There is no test suite. For pure functions in `app/lib`, compile the module to
  a temp dir and drive it from a throwaway Node script — that is the only
  available proof.

## Style

- Comments explain *why* a rule exists, not what the line does.
- Style is inline `style={{}}` objects against CSS custom properties
  (`var(--accent-green)`, `--bg-card`, `--text-muted`). No CSS modules, no
  Tailwind utility classes in components.
- Colours: green `#00e57a`, red `#ff4d6a`, amber `#fbbf24`, blue `#4d9fff`.
  Severity maps live in `LEVEL_STYLE` — do not inline a second palette.
- Charts are Recharts inside `ResponsiveContainer`; sizing comes from the
  `SectionCard` wrapper, so set an explicit `height` on every chart.

Global rules: `~/.config/opencode/AGENTS.md` · Workspace map:
`../REPO_MAP.md`