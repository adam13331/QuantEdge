# CONTEXT.md — current project state

Rewritten/updated every conversation when anything below changes. If nothing
changed, say so in one line and leave the rest untouched. This file answers
"where were we?" — `MAP.md` answers "where is the code?".

## Snapshot

- **Date:** 2026-11-04 · **Branch:** `main` · **Head:** `d2fe6b5`
- **Version:** `package.json` says 0.1.0; the fork is based on Journedge v4.0.0
  (MIT). No git tag exists yet, so the updater has no release to offer.
- **Stack:** Next.js ^16.4.3 · React 19.2.3 · TypeScript 5 · Prisma 5.22 /
  SQLite · Recharts · react-pdf · Tailwind v4
- **Repo:** `adam13331/QuantEdge`. In-app updater targets this repo; the fork
  has **no published release yet**, so the updater reports that clearly.

## In flight (uncommitted)

- Payout tracker on the Prop Firm tab (2026-11-04): new `PropLedgerEntry`
  table (signed `amount`, fees negative; cascade from `Account`, migration
  `20261104122800_prop_ledger`), `/api/prop-ledger` GET/POST/DELETE which owns
  the sign, `payoutSummary` + `payoutCurve` in `analytics.ts`, and
  `app/components/PayoutTracker.tsx` mounted after the return-on-fee card in
  `PropFirmPanel`. `MAP.md` updated. Uncommitted; nothing staged. The ledger
  was exercised live (fee $540 + payout $1,840 → net $1,300, 341% recovered,
  chart, delete, reload persistence) and left empty in the dev DB.
- Prop Firm split into two subtabs (2026-11-04): `Evaluation` (verdict, setup,
  simulation, rules, day by day, pace, risk budget) and `Funded ROI` (return on
  the fee, fee/split/months assumptions, payout tracker). `activeTab` in
  `PropFirmPanel`; the definitions list is filtered per tab rather than
  duplicated. The fee/split/months/expected fields moved out of the challenge
  setup card onto the ROI tab, since they feed `challengeROI` rather than the
  rules. The simulation still runs for both tabs — the ROI figures need the
  pass rate.
- Model-vs-ledger comparison (2026-11-04): `costComparison` in `analytics.ts`
  pairs `challengeROI.costToPass` with the ledger's fees and returns null when
  there is no pass rate to model from. `PayoutTracker` renders it as a strip
  under its tiles and colours the delta green / amber; `PropFirmPanel` passes
  `sim.passRate > 0 ? roi.costToPass : null`. Ten throwaway assertions cover
  the degenerate estimates and the payout-entries-are-not-spend case.

- The 2026-11-03 items below were committed in `d2fe6b5` (working tree was
  clean at the start of the 2026-11-04 session):

- Research loop (2026-11-03): `Trade` gained review fields (`followedPlan`,
  `mistakeTags`, `confidence`) and market context (`atr`, `spread`, `dayRange`
  from the exporter), plus `setupVersion` and `isForwardTest`; new `Experiment`
  model and `/api/experiments`; `Playbook.revisions` stamps rule changes.
  Analytics added a research layer (Wilson/bootstrap intervals, `cohortStats`,
  `compareCohorts`, capture/ATR/RR buckets, `adherenceStats`, `weeklyReview`) and
  the UI gained a Compare tab, Process adherence panel, Execution research
  cards, Playbook experiment log and a new Review page (`R`). Migration
  `20261103085310_strategy_research` applied.
- Deeper UI pass (2026-11-03): `TradeSearch.tsx` adds a ⌘K/Ctrl+K palette
  (symbol/date/tag/setup/journal text, arrow keys + Enter, 8 results) reachable
  from a new sidebar button; Export seeds its period from the dashboard
  `dateRange` and offers "Use dashboard period" when the two diverge; the Prop
  Firm fan hides its 60 sampled attempts behind a `Show N paths` toggle; Account
  cards lead with live equity and P&L/% and gained an explicit `Set active`;
  Settings has a Risk Controls section (daily loss limit / max trades, both
  consumed by the Dashboard guard) and a separate Danger zone holding reset and
  clear-trades.
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
 
- `package.json` / `package-lock.json`: `next` bumped `16.2.6` → `^16.4.3`.
  Not committed. Build is assumed green (`Compiled successfully`); DEP0205
  warning on stderr is expected noise.
- `MAP.md` added, `REPO_MAP.md` deleted (previous session). Needs a commit.
- Dashboard symbol filter added: `symbolFilter` in `AppContext` (persisted as
  `quantedge_symbol_filter`), select in `GlobalDateFilter` next to the period,
  applied in `useAnalyticsSummary` by `underlying || symbol`.
- Headline card renamed "Max Drawdown" → "Drawdown". Its figures (and the
  equity/drawdown curves, Calmar included) now open at `openingEquity`
  (initialBalance + P&L of account trades before the slice) instead of
  `initialBalance`, so filtered views don't overstate the decline.
- Recommendations redesigned: the worst finding renders as a hero card
  (verdict, figure, five-band `GradeScale`, next step), the rest are compact
  expandable rows. `LOOK_FOR` (41 scales) gained an `action` line per metric;
  `Insight.guide` still tags every rule. The two guidance toggles became one
  `settings.guidance` control (`off` / `benchmarks` / `full`) with migration
  from the old booleans.
- Prop Firm tab redesigned: verdict hero (pass-rate ring + standing +
  target/drawdown/worst-day), firm presets as chips, rule fields behind an
  `Edit rules` toggle, rule-by-rule tiles, a day-by-day bar chart against the
  daily limit, simulation + fan in one card, and the definitions collapsed
  into one panel. All figures still read `challengeStatus` /
  `simulateChallenge` / `challengePlan` / `challengeROI`.
- Journal tab removed (2026-11-02): `JournalPage.tsx` is deleted, `"journal"`
  is gone from `PageId`, `NAV_ITEMS` and the `J` shortcut. Journal entries are
  reached through Calendar → trade panel → Full Journal, and the editor's back
  link now returns to Calendar. `journal-editor` stays as a `PageId` because
  TradePanel opens it.
- Dashboard R-Multiples subtab removed (2026-11-02): the tab, its metric cards,
  distribution chart and symbol breakdown are gone, along with the orphaned
  `rmultiplesInsights` rules and four unused reference scales/thresholds. The
  PDF and Export page still report R-multiple distribution; `analytics.ts` is
  untouched.
- Trade Plans tab removed: `PlansPage.tsx`, `/api/plans`, the `"plans"`
  `PageId`, the `P` shortcut, the context plans slice and the `TradePlan` TS
  type. The Prisma `TradePlan` model and table are kept so no saved plan is
  dropped; `scripts/seed-example.js` no longer creates plans.
- Project audit (2026-11-01) fixed: the MT5 exporter header was missing
  `Post Close MFE`, so every field from `Exit Reason` on imported shifted; the
  updater backed up the wrong SQLite path (`prisma/quantedge.db` instead of
  `prisma/prisma/quantedge.db`) and skipped the backup silently. Analytics: Sortino
  denominator, `$/hour` numerator, revenge-trade comparison, per-symbol grouping,
  MAE/MFE chart ordering, and an unused broken `breakevenTrades` field. Deleted
  `ExportPDFButton.tsx`, `PDFExportInner.tsx`, `scripts/_dbcheck.js`.
- No stash. No open PR referenced.

## Recent work (newest first)

- `d2fe6b5` "Redesign" — committed the 2026-11-03 redesign batch (research
  loop, UI pass, prop-firm redesign, guides). `662c602` "More visuals" before it.
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

- Commit the payout tracker (schema + migration, `prop-ledger` route,
  `analytics.ts` helpers, `PayoutTracker.tsx`, doc updates). Uncommitted;
  nothing is staged.
- Tag and publish a first QuantEdge release so the in-app updater has a target.
- Fix the four lint-dirty files so `npm` lint can become a gate.
- `REPO_MAP.md` was drifting when deleted (missing `AnalyticsSections.tsx`,
  `PropFirmPage.tsx`, stale line counts) — `MAP.md` supersedes it; do not
  recreate a second map file.

## Session log

- 2026-11-16 — Calendar overhaul (ten items): it now applies the global
  `dateRange` + `symbolFilter` itself and offers a clear-filters banner (it was
  the only page ignoring them); month names, weekday headers, the drawer
  heading and the best/worst dates follow `settings.language` instead of
  hardcoded `en-US`; the day drawer shows a Long/Short split strip and each row
  carries its % alongside the $, plus planned risk, R (`tradeR`, average-loss
  fallback), hold time, exit time and exit reason; day cells flag a daily-loss
  or trade-cap breach from the Settings risk controls (`dayRisk`, same
  comparison as the Dashboard guard); the grid gained a Week column
  (`monthWeeks`) and the monthly cards a Journaled card; the drawer steps to the
  neighbouring trading day with ‹ › and the arrow keys, and the month/selection
  is kept per tab in `sessionStorage`; a missing-notes toggle dims written-up
  days; empty days open the drawer with an inline quick-add form that POSTs
  through `/api/trades`; and months under `SAMPLE_FLOOR` (30, now shared with
  `insights.ts` `T.minSampleTrades`) lead with the provisional caveat.
  `byDirection` is now case-insensitive via the new `tradeSide`. The Week column
  is dropped below 760px (`matchMedia`, like `Sidebar`), because at 480px it
  left the day cells 35px wide; without it they are 48px and the grid fits.
  Eighteen throwaway assertions cover the new `analytics.ts` helpers; typecheck,
  per-file lint, `scripts/i18n-check.js` and the production build are clean.
  Verified live at 1600 and 480px (no element crosses the viewport, drawer
  fills the screen and its form fits), plus one quick-add round trip
  (created, appeared in the drawer with its %, then deleted again).
  `docs/screenshots/calendar.png` is stale — regenerating it needs the example
  dataset on a second port, not the working journal.

- 2026-11-16 — The Calendar's day drawer (`CalendarPage`) now shows each
  trade's direction as a Long/Short chip beside the symbol, coloured with the
  profit/loss tokens. Direction is read case-insensitively from
  `Trade.direction`, so hand-entered `Long` and exported `long` both render.
  Typecheck clean; the file's two pre-existing `set-state-in-effect` lint
  errors are untouched.

- 2026-11-04 — Reorganised the Evaluation and Funded ROI tabs around one
  collapsed input card each. On Evaluation everything that configures the
  measurement — stage switch, sample source, the four custom-metric fields,
  preset chips and the rule grid — now lives inside the single "Set up the
  evaluation" card behind `editing`, with `setupSummary` (which gained the
  source) as the one-line stand-in; the standalone sample-source card is gone.
  The replay cards (rule by rule, day by day) moved below the simulation card
  so the tab reads verdict → setup → how it plays out → what would end it.
  The simulation card is now "How it plays out", and its duplicate "pass (any
  path)" tile was dropped because the outcome chips above it already carry the
  pass rate. On Funded ROI the return on the fee comes first and the
  assumptions sit under it, collapsed to `assumptionSummary` behind
  `assumptionsOpen`. Checked live at 1400px and 720px in both trade and custom
  modes (no horizontal overflow), and the custom-mode fields still appear only
  when the source is `custom`.

- 2026-11-04 — The Evaluation tab can now model an evaluation from custom
  metrics instead of the journal. `ChallengeConfig` gained `source`
  (`trades` | `custom`) and `customWinRate` / `customAvgWin` / `customAvgLoss` /
  `customTradesPerDay`; `syntheticTrades()` builds a seeded, constant-size pool
  and `simulateChallenge()` accepts it because it only ever read `pnl` and
  `date`. Custom mode swaps the hero for a modelled one and hides the
  replay-only cards (rule by rule, day by day, time & pace, risk budget); the
  simulation and its fan still run. Thirteen assertions cover determinism, the
  win/loss sizes, pace, empty assumptions, expectancy ($24 at 45% / $200 /
  $120) and an all-loser pool never passing. Checked live: custom mode showed
  90% modelled at the defaults, 65% win rate pushed it to 100%, and switching
  back restored every replay card.

- 2026-11-04 — Renamed the Prop Firm sub-tab `Challenge` → `Evaluation` and
  made the profit target phase-aware: `ChallengeConfig.phase`
  (`challenge` | `verification`) plus `verificationTargetPct` (default 5%, no
  schema or localStorage migration needed — configs merge over
  `DEFAULT_CHALLENGE`). Every rule check, the chart's target line, the PDF and
  the Export page now read `targetPctFor(config)` instead of `config.targetPct`.
  The setup card gained a Stage switch and the target field relabels itself to
  `Challenge target %` / `Verification target %`. Checked live: switching to
  Verification re-scored the same trades (+5% target, $500 on a $10k account,
  89% pass rate vs 90%), editing the verification target to 6% left the
  challenge target at 10%, and the ROI tab's definitions still filter to their
  own three entries after the tab-key rename.

- 2026-11-04 — Ledger entries now carry the prop firm: `PropLedgerEntry.firm`
  (nullable, additive migration `20261104142022_ledger_firm`, DB backed up to
  `/tmp/qe-firm-backup/` first), written by `/api/prop-ledger` from a new
  prefilled form field. The tracker's subtitle names the account's current firm,
  and a row is badged only when its firm differs from that preset — so a fee
  recorded under FTMO still says so after the preset is switched to Apex.
  Checked live: form saved `firm: "FTMO (2-Step)"`, switching the preset to
  Apex badged the existing row, switching back cleared the badge; test rows
  deleted and both ledgers left empty.

- 2026-11-04 — Gave the payout tracker a calendar-style period stepper
  (`Month` / `Year` / `All` plus ‹ › arrows, default All). Scope filters on the
  `YYYY-MM-DD` prefix, so no date is parsed; tiles, composition bar, chart and
  rows all read the filtered `payoutSummary` / `payoutCurve`. The model-vs-
  ledger strip is all-time only, and switching to a month or year snaps to the
  most recent entry rather than an empty period. The add form opens on the
  period's first day when today is outside it. Checked live across Sep–Dec 2026
  (Sep $540 in, Oct $540 in / $1,840 out = 341%, Nov $540 in, Dec empty with
  its own copy, Year 2026 $1,620 / $1,840 = 114%); the bar wraps at 720px with
  no overflow; all test rows deleted and both ledgers left empty.

- 2026-11-04 — Added the model-vs-ledger strip to the payout tracker: the
  expected fee spend (`costToPass`) beside the fees the ledger records, with a
  green/amber delta and a matching definitions entry. Checked live with a
  $540 fee against a ~$605 model ("$65.52 under the estimate", green) and
  $740 ("$136.38 over", amber); test rows deleted, both ledgers empty again.
  The strip wraps to a second line at 720px with no overflow.

- 2026-11-04 — Split the Prop Firm page into `Challenge` / `Funded ROI`
  subtabs on the dashboard's sticky pill strip, moving the buy-in terms to the
  ROI tab and filtering the definitions per tab. Verified in the browser: both
  bodies render their own cards, the fee edits on the ROI tab flow into the ROI
  figure and the payout form, and no horizontal overflow at 900px or 1440px.
  Typecheck and per-file lint clean; the panel's one pre-existing
  `set-state-in-effect` error is untouched.

- 2026-11-04 — Added the prop-firm payout tracker: `PropLedgerEntry` Prisma
  model + additive migration (DB backed up to `/tmp/qe-payout-backup/` first),
  `/api/prop-ledger`, `payoutSummary`/`payoutCurve`, and a `PayoutTracker`
  section on the Prop Firm page. Eight pure-function checks passed via a
  throwaway script; typecheck and per-file lint clean; `next build --webpack`
  compiles and generates 16 pages (the Turbopack build fails in this Linux
  shell spawning its node pool during CSS processing — environmental, so the
  webpack path is what was proven).
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
- 2026-11-13 — Accounts: the name is now editable in place on the card, like
  the starting balance (`PATCH /api/accounts`). Refreshed `README.md` and every
  `docs/screenshots/*.png` in English from the example dataset (a throwaway
  database on a second port, so the working database was never seeded);
  `scripts/capture-screenshots.js` also captures Review and Accounts now.
  Fixed two words that had lost their trailing space in the i18n pass
  ("Showing 295 trades", "No trades recorded in November").
- 2026-11-13 — Added English/Hungarian to Settings (`useSettings.language`) and
translated the whole interface: `app/lib/i18n.ts` (exact then figure-masked
lookup, `t`/`count`) plus ten `i18n.hu.*.ts` dictionaries (1546 entries); every
page, component, PDF and `natives confirm` path now renders through `tr(...)`,
including insight prose; `scripts/i18n-check.js` verifies coverage, untranslated
values and placeholder parity. Updated `MAP.md`.
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
