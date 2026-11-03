# CONTEXT.md — current project state

Rewritten/updated every conversation when anything below changes. If nothing
changed, say so in one line and leave the rest untouched. This file answers
"where were we?" — `MAP.md` answers "where is the code?".

## Snapshot

- **Date:** 2026-11-03 · **Branch:** `main` · **Head:** `662c602`
- **Version:** `package.json` says 0.1.0; the fork is based on Journedge v4.0.0
  (MIT). No git tag exists yet, so the updater has no release to offer.
- **Stack:** Next.js ^16.4.3 · React 19.2.3 · TypeScript 5 · Prisma 5.22 /
  SQLite · Recharts · react-pdf · Tailwind v4
- **Repo:** `adam13331/QuantEdge`. In-app updater targets this repo; the fork
  has **no published release yet**, so the updater reports that clearly.

## In flight (uncommitted at last session)

- Research loop (2026-11-03): `Trade` gained review fields (`followedPlan`,
  `mistakeTags`, `confidence`) and market context (`atr`, `spread`, `dayRange`
  from the exporter), plus `setupVersion` and `isForwardTest`; new `Experiment`
  model and `/api/experiments`; `Playbook.revisions` stamps rule changes.
  Analytics added a research layer (Wilson/bootstrap intervals, `cohortStats`,
  `compareCohorts`, capture/ATR/RR buckets, `adherenceStats`, `weeklyReview`) and
  the UI gained a Compare tab, Process adherence panel, Execution research
  cards, Playbook experiment log and a new Review page (`R`). Migration
  `20261103085310_strategy_research` applied. Uncommitted.
- Deeper UI pass (2026-11-03): `TradeSearch.tsx` adds a ⌘K/Ctrl+K palette
  (symbol/date/tag/setup/journal text, arrow keys + Enter, 8 results) reachable
  from a new sidebar button; Export seeds its period from the dashboard
  `dateRange` and offers "Use dashboard period" when the two diverge; the Prop
  Firm fan hides its 60 sampled attempts behind a `Show N paths` toggle; Account
  cards lead with live equity and P&L/% and gained an explicit `Set active`;
  Settings has a Risk Controls section (daily loss limit / max trades, both
  consumed by the Dashboard guard) and a separate Danger zone holding reset and
  clear-trades. Uncommitted.
- UI/UX pass applied (2026-11-02): semantic colour tokens plus a light-theme
  accent map and theme-aware logo; SVG fill/stroke attribute mapping in
  `globals.css` because recharts/lucide attribute colours cannot read `var()`;
  Dashboard page header, period presets and "Showing X of Y" scope; compact
  icon sidebar below 1100px and auto-fit metric grids; shortcut/overlay guards
  and a keyboard-shortcuts button; dirty-close warning in TradePanel; journal
  next/prev, restored calendar day and missing-journal indicators; small-sample
  caveat moved to a banner so the worst finding is the hero; sticky analytics
  tabs; loading skeleton; import onboarding with a new `GET /api/exporter`
  download; calendar `Days` → `Trades`; Export button now "Download PDF".
  Uncommitted.
- `package.json` / `package-lock.json`: `next` bumped `16.2.6` → `^16.4.3`.
  Not committed. Build is assumed green (`Compiled successfully`); DEP0205
  warning on stderr is expected noise.
- `MAP.md` added, `REPO_MAP.md` deleted (previous session). Needs a commit.
- Dashboard symbol filter added: `symbolFilter` in `AppContext` (persisted as
  `quantedge_symbol_filter`), select in `GlobalDateFilter` next to the period,
  applied in `useAnalyticsSummary` by `underlying || symbol`. Uncommitted.
- Headline card renamed "Max Drawdown" → "Drawdown". Its figures (and the
  equity/drawdown curves, Calmar included) now open at `openingEquity`
  (initialBalance + P&L of account trades before the slice) instead of
  `initialBalance`, so filtered views don't overstate the decline. Uncommitted.
- Recommendations redesigned: the worst finding renders as a hero card
  (verdict, figure, five-band `GradeScale`, next step), the rest are compact
  expandable rows. `LOOK_FOR` (41 scales) gained an `action` line per metric;
  `Insight.guide` still tags every rule. The two guidance toggles became one
  `settings.guidance` control (`off` / `benchmarks` / `full`) with migration
  from the old booleans. Uncommitted.
- Prop Firm tab redesigned: verdict hero (pass-rate ring + standing +
  target/drawdown/worst-day), firm presets as chips, rule fields behind an
  `Edit rules` toggle, rule-by-rule tiles, a day-by-day bar chart against the
  daily limit, simulation + fan in one card, and the definitions collapsed
  into one panel. All figures still read `challengeStatus` /
  `simulateChallenge` / `challengePlan` / `challengeROI`. Uncommitted.
- Journal tab removed (2026-11-02): `JournalPage.tsx` is deleted, `"journal"`
  is gone from `PageId`, `NAV_ITEMS` and the `J` shortcut. Journal entries are
  reached through Calendar → trade panel → Full Journal, and the editor's back
  link now returns to Calendar. `journal-editor` stays as a `PageId` because
  TradePanel opens it. Uncommitted.
- Dashboard R-Multiples subtab removed (2026-11-02): the tab, its metric cards,
  distribution chart and symbol breakdown are gone, along with the orphaned
  `rmultiplesInsights` rules and four unused reference scales/thresholds. The
  PDF and Export page still report R-multiple distribution; `analytics.ts` is
  untouched. Uncommitted.
- Trade Plans tab removed: `PlansPage.tsx`, `/api/plans`, the `"plans"`
  `PageId`, the `P` shortcut, the context plans slice and the `TradePlan` TS
  type. The Prisma `TradePlan` model and table are kept so no saved plan is
  dropped; `scripts/seed-example.js` no longer creates plans. Uncommitted.
- Project audit (2026-11-01) fixed: the MT5 exporter header was missing
  `Post Close MFE`, so every field from `Exit Reason` on imported shifted; the
  updater backed up the wrong SQLite path (`prisma/quantedge.db` instead of
  `prisma/prisma/quantedge.db`) and skipped the backup silently. Analytics: Sortino
  denominator, `$/hour` numerator, revenge-trade comparison, per-symbol grouping,
  MAE/MFE chart ordering, and an unused broken `breakevenTrades` field. Deleted
  `ExportPDFButton.tsx`, `PDFExportInner.tsx`, `scripts/_dbcheck.js`. Uncommitted.
- No stash. No open PR referenced.

## Recent work (newest first)

- `cfd4d60` "my changes" — snapshot commit of the fork work.
- 2026-10-31 — removed the auto-created Portfolio account entirely
  (`AppContext`, `AccountsPage`, `ImportPage`, accounts API guard). A stale
  `portfolio` row is deleted on load.
- `d3a0c9e` global date filter, prop-firm simulator, dashboard refresh
- `bef2521` screenshots regenerated with example data
- `1bf7fc2` / `9b267ec` wordmark + favicon fixes
- `b96f047` rebrand Journedge → QuantEdge (db, filenames, localStorage keys,
  PDF wordmark, MT5 exporter all renamed)
- `8239e92` insights engine, prop-firm page, MT5-native metrics
- `3ceab04` / `cbaaf25` PDF process+execution sections, MT5-only import,
  portfolio account

## Known issues / deliberate gaps

- **No test suite.** Only verification: tsc `--noEmit`, per-file eslint, build,
  and throwaway Node scripts for pure `app/lib` functions.
- **`npm run lint` fails on pre-existing errors** in `JournalToolbar`,
  `Sidebar.tsx`, `TradePanel`, `PropFirmPanel`. Do not claim the tree is clean;
  lint only your own files.
- **`npx` is blocked** on the maintainer's machine (PowerShell execution
  policy). Call binaries directly — see `AGENTS.md` → Verify.
- **CHANGELOG.md "Unreleased — QuantEdge fork"** section is the pending release
  notes; it is not regenerated by `scripts/changelog.js` (that only appends
  Journedge-style entries from git log).
- **`prisma/prisma/quantedge.db`** is the live, gitignored dev database (Prisma
  resolves the URL against the schema folder). Never read it. No seed script in
  production paths — `scripts/seed-example.js` exists but is manual and not
  wired to the app.
- **`scripts/capture-screenshots.js` needs `playwright`**, which is not in
  `package.json`. It is a maintainer tool only; install it manually before use.
- Screenshots in `docs/screenshots/` were captured against example data; if
  Analytics visuals change materially, they are stale.

## Next candidates (unconfirmed — ask before assuming)

- Commit the current working tree (filters, guides, audit fixes, doc updates).
  It is deliberately left uncommitted; nothing is staged.
- Tag and publish a first QuantEdge release so the in-app updater has a target.
- Fix the four lint-dirty files so `npm` lint can become a gate.
- `REPO_MAP.md` was drifting when deleted (missing `AnalyticsSections.tsx`,
  `PropFirmPage.tsx`, stale line counts) — `MAP.md` supersedes it; do not
  recreate a second map file.

## Session log

- 2026-11-03 — Added a `timeFormat` setting (`24h` | `12h`, default `24h`) and
  `app/lib/time.ts` `formatTime`; Calendar drawer, journal stat pills and the PDF
  trade history now honour it. Stored times stay 24h. Verified live by toggling
  (5:20 PM vs 17:20); default left at 24h.
- 2026-11-03 — Built the five-phase research plan: trade review fields, setup
  versioning and exporter market context (Phase 1); cohort comparison with
  confidence intervals and trades-needed (Phase 2); per-setup expectancy
  scorecards plus MFE-capture, stop-in-ATR and intended-R:R tables (Phase 3);
  experiments with before/after cohorts and a forward-test cohort (Phase 4); and
  a Weekly review page (Phase 5). Verified against seeded data then restored the
  live DB from `/tmp/qe-phase-backup/quantedge-migrated.db` (71 trades, both
  FTMO accounts). Typecheck clean; lint clean on new files (pre-existing `any`
  formatters in AnalyticsSections and one unescaped quote in PlaybookPage remain).
- 2026-11-03 — Rewrote `README.md` from 30 KB to 8 KB: fork notice, a two-column
  screenshot grid, feature groups, install/import/architecture, and a shortcuts
  table that matches the app (no Journal page, no R-Multiples tab, no standalone
  sizing calculator; `⌘K` search and Settings risk controls included).
  Regenerated all `docs/screenshots/*.png` (1600×1000 @2x) from the example
  dataset after backing up the live DB to `/tmp` and restoring it byte-for-byte;
  deleted the images for removed screens. `capture-screenshots.js` now drives
  analytics from the Dashboard (the Analytics nav item is gone) and allows 90s
  for the Export page because its PDF preview stalls `document.fonts`.
- 2026-11-03 — Finished the deeper UI items: global trade search, Export period
  seeded from the dashboard, Prop Firm fan defaulting to the band with an
  optional path overlay, live equity on account cards with explicit activation,
  and Settings risk controls + danger zone. Verified in the running app on port
  34575 (⌘K opens and Enter opens the trade panel; the risk limit surfaced the
  Dashboard guard $0.00 / $500.00, then was reverted to off); typecheck clean,
  lint clean on the touched files, remaining failures are pre-existing.
- 2026-11-02 — Applied the UI/UX review's quick wins and half-day items: light
  mode/token pass, dashboard header and filter presets, compact sidebar and
  responsive grids, overlay shortcut guards, dirty-close guard, journal
  continuity (next/prev, restored day, missing-note dots), caveat banner and
  sticky tabs, loading skeleton, import steps plus exporter download route.
- 2026-11-02 — Removed the Journal tab and page; journal editing is now reached
  from the Calendar's trade panel, with the editor's back link retargeted to
  Calendar. Removed the stale Journal/R-Multiples entries from the screenshot
  script.
- 2026-11-02 — Removed the Dashboard's R-Multiples subtab and its now-orphaned
  insight rules; updated `MAP.md` symbol index.
- 2026-11-01 — Added the Dashboard symbol filter (context state, global control,
  analytics slice, empty-state copy); renamed the headline drawdown card and
  corrected its baseline under filters; added graded "what to look for" scales
  to every recommendation, then redesigned the guidance layer into a hero
  finding + compact rows with a five-band visual scale and a single tri-state
  Guidance setting; removed the Trade Plans tab and its API while keeping the
  plan table intact; ran a full project audit and fixed the exporter header,
  updater backup path and six analytics bugs; deleted dead files; refreshed
  `MAP.md`, `AGENTS.md`, `README.md` and the changelog.
- 2026-10-31 — Created `MAP.md` (token-efficient agent navigator), deleted
  `REPO_MAP.md`, added this file, added the doc-maintenance rule to `AGENTS.md`.
