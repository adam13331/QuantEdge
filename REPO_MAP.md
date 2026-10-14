# journedge — Repository Map

Trading journal. Next.js 16 App Router (single route), Prisma + SQLite, Recharts,
react-pdf, MetaTrader CSV import. Read this before scanning directories; the list
below is the whole editable surface.

`AGENTS.md` has the rules. This file is the map.

## Shape

- One URL: `/`. `app/page.tsx` picks a component from a `PageId` string.
- No router. No `useRouter`. No per-page route files.
- Data flows: MetaTrader CSV → `app/lib/parseMetaTraderCSV.ts` → `/api/trades`
  → Prisma/SQLite → `AppContext` fetches everything on mount → pages filter in
  memory by `activeAccount`.
- JSON-in-TEXT columns (`tags`, `imageUrls`, `rules`, `entryTriggers`):
  stringified in the route handler, `JSON.parse`d on the client.

## Entry & config

| File | Lines | Purpose |
| --- | --- | --- |
| `app/page.tsx` | 195 | Root client shell: `PageId` → component map, shortcuts modal |
| `app/layout.tsx` | 52 | Metadata, pre-paint theme/accent localStorage script |
| `app/globals.css` | 77 | Tailwind directives, CSS custom-property theme tokens |
| `package.json` | 48 | Scripts: `dev`, `build`, `start`, `lint` (no test script) |
| `next.config.ts` | 10 | Disables dev indicator, turbopack root |
| `tsconfig.json` | 34 | Strict TS, bundler resolution, `@/*` → `./*` |
| `eslint.config.mjs` | 18 | Flat config, `eslint-config-next` + TS rules |
| `postcss.config.mjs` | 7 | Tailwind v4 PostCSS plugin |
| `.env.example` | 7 | `DATABASE_URL="file:./prisma/journedge.db"` |
| `.gitignore` | 57 | Ignores db files, `public/uploads`, `/backups`, `.next` |

## Prisma & data

| File | Lines | Purpose |
| --- | --- | --- |
| `prisma/schema.prisma` | 111 | 6 models: Trade, Account, TradePlan, Playbook, JournalTemplate, Tag |
| `prisma/migrations/20260224004859_init` | 27 | Trade table |
| `prisma/migrations/20260227023608_add_accounts` | 46 | Account + `Trade.accountId` |
| `prisma/migrations/20260401232650_add_templates_and_tags` | 17 | JournalTemplate + Tag |
| `prisma/migrations/20260406000001_add_mae_mfe` | 3 | `Trade.mae` / `Trade.mfe` |
| `prisma/migrations/20260410132401_add_tradeplan_playbook_additions` | 46 | TradePlan + Playbook |
| `prisma/migrations/20260410143735_sync_playbook_adjustments` | 22 | Playbook table rebuild |
| `prisma/migrations/20261010092422_rename_broker_to_platform` | 23 | `Account.broker` → `Account.platform` |
| `prisma/migrations/20261010110706_add_planned_risk_and_duration` | 3 | `durationMin` / `plannedRisk` |
| `prisma/migrations/20261011120000_add_execution_fields` | 6 | exitReason, magic, legs, averagedDown, balanceAfter |
| `prisma/journedge.db` | — | Local SQLite created by `prisma migrate dev`. Gitignored, never read |

Migration is manual (`npx prisma migrate dev`). No seed script exists.

## lib — the trading math

Everything analytical lives here. Pages and the PDF report consume it; none of
them recompute anything.

| File | Lines | Purpose |
| --- | --- | --- |
| `app/lib/analytics.ts` | 1206 | **Source of truth.** Sharpe/Sortino/Calmar, expectancy, drawdown, R-multiples, streaks, revenge sequences, stop quality, leg stats, cash-flow reconciliation, prop-firm challenge + Monte Carlo sim, `buildReportStats` |
| `app/lib/insights.ts` | 1380 | Recommendation rules. `buildInsights(facts)` → ranked `Insight[]` per Analytics tab; thresholds in one block |
| `app/lib/parseMetaTraderCSV.ts` | 226 | CSV sniff/parse → `Trade[]`; owns `JOURNEDGE_COLUMNS` |
| `app/lib/types.ts` | 109 | Interfaces for every entity + the `PageId` union |
| `app/lib/db.ts` | 10 | PrismaClient singleton cached on `globalThis` (dev HMR) |
| `app/lib/svgToPng.ts` | 27 | Canvas SVG → base64 PNG for the PDF logo |

## Hooks & context

| File | Lines | Purpose |
| --- | --- | --- |
| `app/context/AppContext.tsx` | 277 | Fetches trades/accounts/tags/plans/playbook on mount; `Portfolio` sentinel; `useApp()` |
| `app/hooks/useSettings.ts` | 87 | localStorage settings; applies accent colour + theme CSS vars |

## Components

| File | Lines | Purpose |
| --- | --- | --- |
| `app/components/TradingReportPDF.tsx` | 1124 | react-pdf document, toggleable sections |
| `app/components/PropFirmPanel.tsx` | 337 | Prop-firm challenge config editor + simulation |
| `app/components/JournalToolbar.tsx` | 639 | TipTap formatting bar |
| `app/components/TradePanel.tsx` | 632 | Slide-out quick-view/edit for one trade |
| `app/components/ExportPDFInner.tsx` | 89 | Client-only PDFDownloadLink wrapper + options |
| `app/components/PDFExportInner.tsx` | 55 | Legacy options-less wrapper |
| `app/components/TagSelector.tsx` | 241 | Attach/create tags on a trade |
| `app/components/Sidebar.tsx` | 211 | `NAV_ITEMS` → `PageId`, account switcher |
| `app/components/AnalyticsCards.tsx` | 123 | `SectionCard`, `MetricCard`, `InsightPanel` primitives |
| `app/components/ExportPDFButton.tsx` | 28 | dynamic `ssr:false` button mounting the PDF |

## Pages

| File | Lines | Purpose |
| --- | --- | --- |
| `app/pages/AnalyticsPage.tsx` | 1540 | 8 Recharts tabs + Prop Firm; hosts the recommendation panels |
| `app/pages/ExportPage.tsx` | 802 | Report options, JSON export, PDF export |
| `app/pages/SettingsPage.tsx` | 882 | Appearance, trading defaults, risk limits, in-app updater |
| `app/pages/PlaybookPage.tsx` | 858 | Setup library CRUD, rules/triggers editors |
| `app/pages/JournalEditorPage.tsx` | 767 | Full-page TipTap editor + templates |
| `app/pages/PlansPage.tsx` | 716 | Pre-trade plan CRUD |
| `app/pages/JournalPage.tsx` | 632 | Day-grouped trade cards |
| `app/pages/Dashboard.tsx` | 615 | Daily risk strip, stat cards, filterable table, position sizer |
| `app/pages/CalendarPage.tsx` | 477 | Month grid, per-day P&L colouring, drill-down |
| `app/pages/ImportPage.tsx` | 372 | CSV drop, format detection, preview, POST |
| `app/pages/AccountsPage.tsx` | 355 | Account CRUD + Portfolio override |

## API routes

| File | Lines | Purpose |
| --- | --- | --- |
| `app/api/update/route.ts` | 434 | Self-update: semver check, db backup, shadow npm install, migrate |
| `app/api/trades/route.ts` | 107 | GET/POST/PATCH/DELETE; derives `hourOfDay`; bulk upsert |
| `app/api/playbook/route.ts` | 67 | CRUD; serialises rules/triggers/images to JSON text |
| `app/api/accounts/route.ts` | 59 | CRUD |
| `app/api/templates/route.ts` | 58 | CRUD |
| `app/api/plans/route.ts` | 51 | CRUD, `?accountId` filter |
| `app/api/tags/route.ts` | 41 | GET list, upsert by name, DELETE |
| `app/api/upload/route.ts` | 26 | Multipart image → `public/uploads/` |
| `app/api/update/restart/route.ts` | 15 | Delayed `process.exit(0)` to restart dev server |
| `app/api/trades/clear/route.ts` | 11 | Wipe all trades |

## Scripts

| File | Lines | Purpose |
| --- | --- | --- |
| `scripts/JournedgeExport.mq5` | 854 | MetaTrader 5 exporter. `OnStart()` writes a 30-column CSV; computes R:R, planned risk, MAE/MFE, legs, balance-after |
| `scripts/changelog.js` | 261 | CLI: git log → grouped `CHANGELOG.md` entry |

## Docs & meta

`README.md` (458, product + architecture) · `CHANGELOG.md` (206, generated) ·
`CONTRIBUTING.md` (105) · `SECURITY.md` (125) · `CODE_OF_CONDUCT.md` (128) ·
`.github/ISSUE_TEMPLATE/bug_report.md` (41) ·
`.github/ISSUE_TEMPLATE/feature_request.md` (32) ·
`docs/screenshots/` (16 PNGs, README assets — do not read)

## Largest files

`AnalyticsPage.tsx` 1540 · `insights.ts` 1380 · `analytics.ts` 1206 ·
`TradingReportPDF.tsx` 1124 · `JournedgeExport.mq5` 854.

Read these by line range with `grep`, never whole.