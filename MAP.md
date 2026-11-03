# MAP.md — AI agent navigator

Companion to `AGENTS.md` (the rules). This file exists so an agent can find the
exact lines it needs and stop reading. **Never read a whole file listed here as
"big" — `grep` the symbol, then `sed` the line range.**

Rules of use:
1. Locate the task in **Where to change what** below.
2. Open the symbol via the **Symbol index** (file + line), read ±30 lines.
3. Do not read files marked ✕. They are binary, generated, or vendored.

Line numbers drift; they are ±10% accurate. If a `grep` for the symbol misses,
fall back to a keyword grep in the same file — the file itself will be right.

## Shape (60 seconds)

- One URL `/`. `app/page.tsx` maps `PageId` → component. No router, no `useRouter`.
- Data: MetaTrader CSV → `app/lib/parseMetaTraderCSV.ts` → `POST /api/trades` →
  Prisma/SQLite → `AppContext` fetches all on mount → pages filter in memory by
  `activeAccount` + global `dateRange`.
- **All trading math is in `app/lib/analytics.ts`.** Pages and the PDF only
  render it. If you are tempted to compute a ratio in a component: stop, add it
  to `analytics.ts`.
- **All recommendations are in `app/lib/insights.ts`.** Pure functions, one
  threshold block `T` at line ~105.
- JSON-in-TEXT Prisma columns (`tags`, `imageUrls`, `rules`, `entryTriggers`):
  stringified in `app/api/*/route.ts`, `JSON.parse`d in `AppContext`. Never
  reverse that direction.

## Where to change what

| Task | Go to |
| --- | --- |
| Add/rename a nav page | `app/lib/types.ts` `PageId` (~98) · `app/components/Sidebar.tsx` `NAV_ITEMS` (~12) · `app/page.tsx` `AppShell` conditional map (158–168) — all three, or it breaks silently |
| New analytics metric | `app/lib/analytics.ts` (new exported fn + add field to `ReportStats` ~1167 / `buildReportStats` ~1232) → consume in `app/components/AnalyticsSections.tsx` |
| New recommendation rule | `app/lib/insights.ts`: add threshold to `T` (~109), push an `Insight` (with a `guide` key) in the matching `<tab>Insights` fn, add any new input to `AnalyticsFacts` (~38) so TS forces the Analytics page to supply it |
| Change a recommendation threshold | `app/lib/insights.ts` `T` block, lines 109–170. Only place thresholds live |
| Edit a "what good looks like" scale | `app/lib/insights.ts` `LOOK_FOR` (191) — `action` is the next-step line, `bands` the reference copy; firing thresholds stay in `T` |
| Add a chart to an Analytics tab | `app/components/AnalyticsSections.tsx`, find the `activeTab === "<id>" &&` block (~606–1460), wrap in `SectionCard` |
| Add a Prisma column | `prisma/schema.prisma` → `npx prisma migrate dev` (manual, no seed script) → `app/lib/types.ts` `Trade` → `scripts/QuantEdgeExport.mq5` header + row → `QUANTEDGE_COLUMNS` in `parseMetaTraderCSV.ts` (order matters, all four) |
| CSV import format | `app/lib/parseMetaTraderCSV.ts` `QUANTEDGE_COLUMNS` (6). Must stay in sync with the `.mq5` exporter; `QUANTEDGE_HEADER` is built from it at line 14 |
| Self-update / backup logic | `app/api/update/route.ts` (458). Keep: db backup → migrate → prune to 5. `findDatabasePath()` must cover both possible SQLite locations |
| PDF report layout | `app/components/TradingReportPDF.tsx` (~311 default export); options wired in `ExportPDFInner.tsx` |
| Theme / accent colour | `app/hooks/useSettings.ts` `applyAccentColor` (59) + CSS vars in `app/globals.css`; accent swatches in `app/pages/SettingsPage.tsx` `ACCENT_COLORS` |
| Settings default | `app/hooks/useSettings.ts`: add a field to `Settings` (~3) and to `DEFAULTS`. localStorage-backed, merged on load |
| Show a trade time | `formatTime(value, settings.timeFormat)` from `app/lib/time.ts` (~7) — stored times stay 24h `HH:MM`; Calendar drawer, journal stat pills and the PDF pass the setting through. Never splice `entryTime` into JSX raw |
| Prop-firm challenge math | `app/lib/analytics.ts` `ChallengeConfig` ~710 → `challengeStatus` ~806 → `simulateChallenge` ~944; UI in `app/components/PropFirmPanel.tsx` |
| Keyboard shortcuts | `app/page.tsx` `SHORTCUTS` ~20 and the handler ~120 (`d c f b i e r`, `/` toggles modal); `⌘K`/`Ctrl+K` is owned by `TradeSearch.tsx`, which also listens for the sidebar's `quantedge:search` event |
| Research layer (CI, cohorts, reviews) | `app/lib/analytics.ts` ~1365 onward: `wilsonInterval` 1379 · `cohortStats` 1449 · `compareCohorts` 1499 · `adherenceStats` 1643 · `setupVersionStats` 1708 · `weeklyReview` 1739; UI in `AnalyticsSections.tsx` `CompareTab` 1678 / `AdherencePanel` 1783 and `app/pages/ReviewPage.tsx` |
| Add a review/market field to a trade | `prisma/schema.prisma` `Trade` → `app/lib/types.ts` → `app/components/TradePanel.tsx` (REVIEW block) or `parseMetaTraderCSV.ts` + `QuantEdgeExport.mq5` for imported fields → `serializeTrade` in `app/api/trades/route.ts` for JSON columns |
| Change the exporter (MT5) | `scripts/QuantEdgeExport.mq5`, `OnStart()`; then mirror in `parseMetaTraderCSV.ts` |

## Symbol index

Only the entries an agent actually needs. `fn` = exported function.

### `app/lib/analytics.ts` (1792) — source of truth
`stdDev` 6 · `normalizeDate` 13 · `getDailyPnl` 21 · `sharpeRatio` 32 ·
`sortinoRatio` 40 · `expectancy` 50 · `profitFactor` 64 · `drawdownStats` 71 ·
`calmarRatio` 107 · `rMultiples` 116 · `R_BUCKET_ORDER` 127 · `rHistogram` 129 ·
`rollingWinRate` 141 · `byDayOfWeek` 151 · `byHourOfDay` 199 · `streaks` 226 ·
`tradeHours` 249 · `parseRR` 280 · `byInstrument` 307 · `durationMinutes` 342 ·
`byDuration` 379 · `byReEntryGap` 409 · `byDirection` 437 · `costProfile` 454 ·
`recoveryFactor` 471 · `revengeSequences` 485 · `rRiskProfile` 523 ·
`stopQuality` 550 · `byExitReason` 590 · `byMagic` 600 · `legStats` 633 ·
`externalCashFlow` 670 · `DEFAULT_CHALLENGE` 726 · `FIRM_PRESETS` 744 ·
`applyPreset` 755 · `challengeStatus` 806 · `simulateChallenge` 944 ·
`challengePlan` 1104 · `challengeROI` 1146 · `ReportStats` 1167 ·
`buildReportStats` 1232

Research layer (1365+): `wilsonInterval` 1379 · `bootstrapMeanCI` 1412 ·
`riskUnit` 1434 · `rSeries` 1440 · `cohortStats` 1449 ·
`sampleSizePerCohort` 1492 · `compareCohorts` 1499 · `mfeCaptureBuckets` 1537 ·
`stopVsAtr` 1567 · `outcomeByIntendedRR` 1622 · `adherenceStats` 1643 ·
`mistakeTagStats` 1678 · `setupVersionStats` 1708 · `weeklyReview` 1739

### `app/lib/insights.ts` (1805) — recommendations
`T` thresholds 109 · `MetricGuide` 177 (label, what, action, bands) · `Grade` 173 ·
`GRADE_ORDER` 175 · `LOOK_FOR` 191 (37 reference scales + next steps) ·
`GuideKey` 409 · `halfTrend` ~420 · `rankBy` ~442 · `overviewInsights` ~464 ·
`riskInsights` ~653 · `timeInsights` ~849 · `heatmapInsights` ~1035 ·
`executionInsights` ~1178 · `behaviorInsights` ~1290 ·
`processInsights` ~1457 · `buildInsights` 1778
Types: `InsightLevel` 18 · `SectionId` 20 · `Insight` 24 (has optional `guide`) ·
`AnalyticsFacts` 38. **Every rule sets `guide`**; a new rule must too, or the
reference scale under the finding disappears. Add a scale to `LOOK_FOR` when
the rule fires on a new metric.

### `app/components/AnalyticsSections.tsx` (1582) — the Analytics page
`useAnalyticsSummary` 61 (filters by dateRange, builds `stats`, maps to
`AnalyticsFacts`) · `OverviewMetrics` 325 · default export 463 · tab switcher
618–629 · tab bodies 632–1582 (`overview` 632 · `risk` 745 · `time` 861 ·
`heatmap` 928 · `execution` 1082 · `behavior` 1145 · `process` 1305)

### Everything else
`app/lib/types.ts` 88 — `Trade` 1 · `Playbook` 41 · `Account` 56 · `Tag` 65 ·
`JournalTemplate` 70 · `PageId` 78

`app/context/AppContext.tsx` 310 — `AppContextType` 38 · `DateRange` 13 ·
`symbolFilter` (state + storage) 110 · `sortAccounts` ~82 · `AppProvider` 101 ·
`useApp` 306

`app/lib/parseMetaTraderCSV.ts` 230 — `QUANTEDGE_COLUMNS` 6 (32 cols, order
is the contract) · `QUANTEDGE_HEADER` 14 · `firstLine` 28 · `isMetaTraderCSV` 33 ·
`parseMetaTraderCSV` 78

`app/hooks/useSettings.ts` 154 — `GuidanceMode` 7 · `Settings` 11 · `guidance`
  (default `"full"`, migrates the old two booleans) 35 · `useSettings` 133
`app/lib/db.ts` 9 — Prisma singleton on `globalThis`
`app/lib/svgToPng.ts` 27 — canvas SVG→PNG for the PDF logo
`app/components/AnalyticsCards.tsx` 357 — `SectionCard` 11 · `MetricCard` 26 ·
`GradeScale` 75 (five-band bar; ranges printed under it) · `NextStep` 114 ·
`HeroFinding` 145 (worst finding, full) · `FindingRow` 202 (compact,
expandable) · `BenchmarkPanel` 266 (guidance = benchmarks) · `InsightPanel` 313
(takes `mode: "full" | "benchmarks"`)
`app/components/Sidebar.tsx` 211 — `NAV_ITEMS`, account switcher
`app/components/GlobalDateFilter.tsx` 88 — writes `dateRange` + `symbolFilter`
to context; symbol options built from the active account's trades
`app/components/TradePanel.tsx` 810 (`MISTAKES` 157, REVIEW block ~590) ·
`JournalToolbar.tsx` 639 (TipTap bar, default export 525) · `TagSelector.tsx` 241 ·
`TradeSearch.tsx` 281 (⌘K palette; `journalText` 11 flattens TipTap JSON for matching) ·
`AnalyticsSections.tsx` 1941 (`useAnalyticsSummary` 62, `CompareTab` 1678,
`AdherencePanel` 1783, `ExecutionResearch` 1867) ·
`PropFirmPanel.tsx` 922 (`TONE` 77, `Ring` 113, `Stat` 138, `RuleTile` 160,
`LegendChip` 207, default `PropFirmPanel` 217 — verdict hero, preset chips,
rule tiles, day-by-day chart, simulation; `showPaths` toggles the per-attempt
lines) ·
`TradingReportPDF.tsx` 1124 (default 311) · `ExportPDFInner.tsx` 90 (the only
PDF wrapper the app imports)

Pages (default export unless noted): `Dashboard` 194 ·
`CalendarPage` 494 · `PropFirmPage` 24 (thin shell over `PropFirmPanel`) ·
`PlaybookPage` 1103 (`ExperimentsPanel` 934) · `ReviewPage` 170 ·
`ImportPage` 520 · `ExportPage` 828 ·
`AccountsPage` 392 · `JournalEditorPage` 767 · `SettingsPage` 858
(`Section` 52 takes `tone`; Risk Controls and Danger zone near the end)

API routes: `exporter` (serves `scripts/QuantEdgeExport.mq5` as a download) ·
`experiments` 66 (CRUD for the research loop) ·
`trades` 107 (GET/POST/PATCH/DELETE, derives `hourOfDay`, bulk
upsert) · `playbook` 67 · `accounts` 59 · `templates` 58 ·
`tags` 41 · `upload` 26 (multipart → `public/uploads/`) · `update` 434 ·
`update/restart` 15 · `trades/clear` 11

Prisma models: `Account` · `Trade` (44 fields, incl. `plannedRisk`,
`durationMin`, `mae`/`mfe`, `exitReason`, `magic`, `legs`, `averagedDown`,
`balanceAfter`, `atr`/`spread`/`dayRange`, `followedPlan`/`mistakeTags`/
`confidence`, `setupVersion`, `isForwardTest`) · `TradePlan` (kept in the schema,
but the Trade Plans tab and `/api/plans` were removed — do not delete the model
without a manual migration) · `Playbook` (holds `revisions`) · `Experiment` ·
`JournalTemplate` · `Tag`.
SQLite via `DATABASE_URL="file:./prisma/quantedge.db"`; Prisma resolves that
relative to `prisma/schema.prisma`, so the live file is
`prisma/prisma/quantedge.db`. Anything touching the database on disk must find
it, not assume the root-relative path (`app/api/update/route.ts`
`findDatabasePath()` checks both).

## ✕ Do not read

- `prisma/prisma/quantedge.db` — local SQLite (also gitignored), never read
- `docs/screenshots/*.png` (16) — README assets
- `public/*.svg`, `app/icon.svg` — logos
- `package-lock.json`, `node_modules/`, `.next/`
- `prisma/migrations/*/migration.sql` — read `schema.prisma` instead
- `CHANGELOG.md` (206, generated by `scripts/changelog.js`)
- `README.md` — read this file and `AGENTS.md` instead

## Verify a change

Per `AGENTS.md`: `npx` is blocked on the maintainer's machine — call binaries
directly (`node node_modules/typescript/bin/tsc --noEmit`, etc.). Lint only
your own files; `npm run lint` has pre-existing failures in `JournalToolbar`,
`Sidebar`, `TradePanel`, `PropFirmPanel`. No test suite — for pure `app/lib`
functions, compile the module to a temp dir and drive it from a throwaway
Node script.

## Keep these files honest

Two companion files must stay true, and the rule is: **update them in the same
change whenever the code changes.**

- `MAP.md` (this file) — update when you add/delete/move a file, or when a
  symbol index entry drifts more than ~50 lines.
- `CONTEXT.md` — refresh at the start of a conversation if the project state
  moved: new commits, uncommitted work, changed known issues. If nothing
  changed, append a one-line "no change" note to the session log and stop.
- `REPO_MAP.md` was deleted on 2026-10-31 (stale). Do not recreate it.
