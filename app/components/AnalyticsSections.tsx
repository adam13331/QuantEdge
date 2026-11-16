"use client";
import { t as tr } from "../lib/i18n";
import { useState, useMemo, Fragment } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie,
  ReferenceLine, AreaChart, Area, ScatterChart, Scatter,
} from "recharts";
import { useApp } from "../context/AppContext";
import {
  TrendingUp, TrendingDown, Target, Zap, Clock,
  BarChart2, Activity, AlertTriangle, Calendar, Shield, Brain, SlidersHorizontal,
} from "lucide-react";

import {
  stdDev, normalizeDate, getDailyPnl, sharpeRatio, sortinoRatio, expectancy,
  profitFactor as profitFactorOf,
  calmarRatio, drawdownStats, rMultiples, rollingWinRate,
  byDayOfWeek, byHourOfDay, streaks,
  byDuration, byReEntryGap, byDirection, costProfile, recoveryFactor,
  rRiskProfile, stopQuality, byExitReason, byMagic, legStats, externalCashFlow,
  revengeSequences,
  cohortStats, compareCohorts, riskUnit, adherenceStats, mistakeTagStats,
  setupVersionStats, mfeCaptureBuckets, stopVsAtr, outcomeByIntendedRR,
} from "../lib/analytics";
import { buildInsights, type SectionId } from "../lib/insights";
import { SectionCard, MetricCard, InsightPanel } from "./AnalyticsCards";
import { useSettings } from "../hooks/useSettings";
import { Trade } from "../lib/types";
import { money as fmtMoney, moneyRaw as fmtMoneyRaw, currencySymbol as currencySign } from "../lib/money";


function tooltipStyleUnused() {}


const tooltipStyle = {
  background: "var(--tooltip-bg)", border: "1px solid var(--chart-grid)",
  borderRadius: "8px", color: "var(--text-primary)", fontSize: "12px",
};
const axisStyle = { fontSize: 12, fill: "var(--text-secondary)" };

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 18px", borderRadius: "8px", border: "none", cursor: "pointer",
        background: active ? "var(--accent-green-dim)" : "transparent",
        color: active ? "var(--accent-green)" : "var(--text-muted)",
        fontSize: "13px", fontWeight: active ? "700" : "400",
        fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s ease",
      }}
    >
      {label}
    </button>
  );
}

type TabId = "overview" | "risk" | "time" | "heatmap" | "execution" | "behavior" | "process" | "compare";

// The period-scoped trade slice and every derived figure, as one hook. It is
// exported so the Dashboard can render the headline metric cards and the tabbed
// body below them from the same numbers: two copies of this maths would be free
// to disagree.
export function useAnalyticsSummary() {
  const { trades: allTrades, activeAccount, dateRange, clearDateRange, symbolFilter } = useApp();
  const { settings } = useSettings();

  // The period comes from the global control in the shell, so it is identical
  // everywhere and does not reset when the tab changes.
  const dateFrom = dateRange.from;
  const dateTo   = dateRange.to;

  const trades = useMemo(() => {
    return allTrades.filter((t) => {
      const d = normalizeDate(t.date);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      // Match the market the control groups by, so picking a symbol leaves
      // exactly the rows the Per-symbol table reports on.
      if (symbolFilter && (t.underlying || t.symbol) !== symbolFilter) return false;
      return true;
    });
  }, [allTrades, dateFrom, dateTo, symbolFilter]);

  const hasRange = Boolean(dateFrom || dateTo);

  const stats = useMemo(() => {
    if (trades.length === 0) return null;

    const sorted = [...trades].sort((a, b) =>
      normalizeDate(a.date).localeCompare(normalizeDate(b.date))
    );

    const wins    = trades.filter((t) => t.status === "win");
    const losses  = trades.filter((t) => t.status === "loss");
    const totalPnl  = trades.reduce((s, t) => s + t.pnl, 0);
    const winRate   = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
    const avgWin    = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss   = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
    // 99 is the display sentinel for "no losing trades"; the card turns it into
    // an infinity symbol rather than showing a made-up ratio.
    const profitFactor = profitFactorOf(wins, losses) ?? (wins.length > 0 ? 99 : 0);

    const initBal = activeAccount?.initialBalance ?? 0;

    // Equity entering the selection. Trades outside the period — or in another
    // symbol — still moved the real balance, so opening at initialBalance would
    // measure the decline against a peak the account had already left. That
    // overstates the drawdown percentage whenever a filter hides an earlier
    // gain, which is why the baseline is built from the whole account.
    const firstDate = sorted.length > 0 ? normalizeDate(sorted[0].date) : null;
    const priorPnl = firstDate
      ? allTrades
          .filter((t) => normalizeDate(t.date) < firstDate)
          .reduce((s, t) => s + t.pnl, 0)
      : 0;
    const openingEquity = initBal + priorPnl;

    // The curve opens on the balance the selection inherited rather than on the
    // first trade, so the line starts where the account actually stood.
    const equityCurve: { date: string; equity: number; pnl: number }[] = [
      { date: "Start", equity: openingEquity, pnl: 0 },
    ];
    let running = openingEquity;
    for (const t of sorted) {
      running += t.pnl;
      equityCurve.push({
        date: normalizeDate(t.date),
        equity: parseFloat(running.toFixed(2)),
        pnl: t.pnl,
      });
    }

    // Y-axis follows the trades rather than the balance. Without an explicit
    // domain recharts defaults an AreaChart to [0, dataMax], so a 1% move on a
    // five-figure balance spans 1% of the axis and renders as a flat line.
    let eqMin = openingEquity, eqMax = openingEquity;
    for (const p of equityCurve) {
      if (p.equity < eqMin) eqMin = p.equity;
      if (p.equity > eqMax) eqMax = p.equity;
    }
    const eqPad = Math.max((eqMax - eqMin) * 0.15, Math.abs(eqMax) * 0.002, 1);
    const equityDomain: [number, number] = [eqMin - eqPad, eqMax + eqPad];

    const daily = getDailyPnl(trades);
    const dailyPnlValues = daily.map((d) => d.pnl);
    const tradingDays = daily.length;

    const sharpe  = sharpeRatio(dailyPnlValues);
    const sortino = sortinoRatio(dailyPnlValues);
    const exp     = expectancy(wins, losses);

    // Same baseline as the curve above, so the card and the chart agree on
    // where the peak was.
    const { maxDd, maxDdPct, longestDdDays, currentDdDays, ddCurve } =
      drawdownStats(sorted, openingEquity);
    const calmar = calmarRatio(totalPnl, initBal, tradingDays, maxDdPct);

    // Risk actually accepted at entry, read from the stop loss MetaTrader
    // recorded. Consistency here is what separates deliberate position sizing
    // from sizing decided in the moment.
    const risked = trades.filter((t) => t.plannedRisk != null && t.plannedRisk > 0);
    const riskVals = risked.map((t) => t.plannedRisk as number);
    const avgRisk = riskVals.length > 0 ? riskVals.reduce((s, v) => s + v, 0) / riskVals.length : 0;
    const minRisk = riskVals.length > 0 ? Math.min(...riskVals) : 0;
    const maxRisk = riskVals.length > 0 ? Math.max(...riskVals) : 0;
    const riskSd  = riskVals.length > 1 ? stdDev(riskVals) : 0;
    const riskConsistency = avgRisk > 0 ? Math.max(0, 100 - (riskSd / avgRisk) * 100) : 0;
    const riskPctAvg = initBal > 0 && avgRisk > 0 ? (avgRisk / initBal) * 100 : 0;
    const riskPctVals = risked.map((t) => (initBal > 0 ? ((t.plannedRisk as number) / initBal) * 100 : 0));
    const riskMissing = trades.length - risked.length;
    // Expectancy expressed in R has to use the same 1R unit the multiples do.
    const rUnit = avgRisk > 0 && risked.length === trades.length ? avgRisk : avgLoss;

    // Losses that came in worse than the risk the trader had planned — usually
    // a stop that was widened, or slippage on the exit.
    let stopBreaches = 0;
    for (const t of risked) {
      const planned = t.plannedRisk as number;
      if (t.pnl < 0 && -t.pnl > planned * 1.05) stopBreaches++;
    }

    const rMs = rMultiples(trades, avgLoss);    const rBuckets: Record<string, number> = {};
    for (const { r } of rMs) {
      const bucket = r <= -3 ? "≤-3R" : r >= 3 ? "≥3R" :
        r < 0 ? `${Math.floor(r)}R` : `+${Math.floor(r)}R`;
      rBuckets[bucket] = (rBuckets[bucket] || 0) + 1;
    }
    const rBucketOrder = ["≤-3R", "-3R", "-2R", "-1R", "+0R", "+1R", "+2R", "≥3R"];
    const rHistogram = rBucketOrder
      .filter((b) => rBuckets[b])
      .map((b) => ({ bucket: b, count: rBuckets[b], positive: b.startsWith("+") && b !== "+0R" }));
    const avgR = rMs.length > 0 ? rMs.reduce((s, r) => s + r.r, 0) / rMs.length : 0;

    const rolling = trades.length >= 20 ? rollingWinRate(sorted, 20) : [];
    const dowData = byDayOfWeek(trades, settings.weekStart);
    const hourData = byHourOfDay(trades);
    const streak  = streaks(trades);

    const bestTrade  = trades.reduce((b, t) => t.pnl > b.pnl ? t : b, trades[0]);
    const worstTrade = trades.reduce((w, t) => t.pnl < w.pnl ? t : w, trades[0]);

    const bySymbol: Record<string, { pnl: number; count: number; wins: number }> = {};
    for (const t of trades) {
      // Same key as byInstrument and the symbol filter: an export with a blank
      // underlying must not collapse every market into one empty bucket.
      const key = t.underlying || t.symbol;
      if (!bySymbol[key]) bySymbol[key] = { pnl: 0, count: 0, wins: 0 };
      bySymbol[key].pnl += t.pnl;
      bySymbol[key].count += 1;
      if (t.status === "win") bySymbol[key].wins += 1;
    }
    const symbolData = Object.entries(bySymbol)
      .map(([s, d]) => ({ symbol: s, pnl: parseFloat(d.pnl.toFixed(2)), count: d.count, wr: Math.round((d.wins / d.count) * 100) }))
      .sort((a, b) => b.pnl - a.pnl);

    const byTag: Record<string, { pnl: number; count: number; wins: number }> = {};
    for (const t of trades) {
      const tags = Array.isArray(t.tags) ? t.tags : [];
      for (const tag of tags as string[]) {
        if (!byTag[tag]) byTag[tag] = { pnl: 0, count: 0, wins: 0 };
        byTag[tag].pnl += t.pnl;
        byTag[tag].count += 1;
        if (t.status === "win") byTag[tag].wins += 1;
      }
    }
    const tagData = Object.entries(byTag)
      .map(([tag, d]) => ({ tag, pnl: parseFloat(d.pnl.toFixed(2)), count: d.count, wr: Math.round((d.wins / d.count) * 100) }))
      .sort((a, b) => b.pnl - a.pnl);

    // MAE / MFE
    const maeFdTrades = trades.filter((t) => t.mae != null && t.mfe != null);
    const hasMaeMfe   = maeFdTrades.length > 0;
    const avgMae = hasMaeMfe ? maeFdTrades.reduce((s, t) => s + t.mae!, 0) / maeFdTrades.length : 0;
    const avgMfe = hasMaeMfe ? maeFdTrades.reduce((s, t) => s + t.mfe!, 0) / maeFdTrades.length : 0;

    const entryEff = hasMaeMfe
      ? maeFdTrades.reduce((s, t) => {
          const total = t.mfe! + t.mae!;
          return s + (total > 0 ? (t.mfe! / total) * 100 : 50);
        }, 0) / maeFdTrades.length
      : 0;

    const winsWithMfe = maeFdTrades.filter((t) => t.status === "win" && t.mfe! > 0);
    const exitEff = winsWithMfe.length > 0
      ? winsWithMfe.reduce((s, t) => s + Math.min(100, (t.pnl / t.mfe!) * 100), 0) / winsWithMfe.length
      : 0;

    const tradeEff = hasMaeMfe
      ? maeFdTrades.reduce((s, t) => {
          const range = t.mfe! + t.mae!;
          return s + (range > 0 ? Math.min(100, ((t.pnl + t.mae!) / range) * 100) : 0);
        }, 0) / maeFdTrades.length
      : 0;

    // "Last 20" has to mean the most recent 20, not the first 20 in whatever
    // order the account fetch returned.
    const maeMfeChart = sorted.filter((t) => t.mae != null && t.mfe != null).slice(-20).map((t, i) => ({
      trade: i + 1,
      mae: parseFloat(t.mae!.toFixed(2)),
      mfe: parseFloat(t.mfe!.toFixed(2)),
      pnl: t.pnl,
      symbol: t.underlying,
    }));

    // Overtrading detection
    const dayCountMap: Record<string, number> = {};
    for (const t of trades) {
      const d = normalizeDate(t.date);
      dayCountMap[d] = (dayCountMap[d] || 0) + 1;
    }
    const dayCountValues  = Object.values(dayCountMap);
    const meanDailyTrades = dayCountValues.reduce((s, v) => s + v, 0) / Math.max(dayCountValues.length, 1);
    const sdDailyTrades   = stdDev(dayCountValues);
    const overtradingThreshold = Math.max(meanDailyTrades + 1.5 * sdDailyTrades, meanDailyTrades + 2);
    const overtradingDays = Object.entries(dayCountMap)
      .filter(([, c]) => c > overtradingThreshold)
      .sort(([, a], [, b]) => b - a)
      .map(([date, count]) => ({ date, count }));

    const revenge = revengeSequences(trades);

    let disciplineScore = 100;
    disciplineScore -= Math.min(40, overtradingDays.length * 8);
    disciplineScore -= Math.min(25, revenge.count * 5);
    if (streak.maxLossStreak > 5) disciplineScore -= 10;
    if (currentDdDays > 14)       disciplineScore -= 10;
    disciplineScore = Math.max(0, Math.round(disciplineScore));

    const maxDayTrades = Math.max(...dayCountValues, 0);

    // Process (Tier A) — how the trading is done rather than what it earned.
    const durationData  = byDuration(trades);
    const gapData       = byReEntryGap(trades);
    const directionData = byDirection(trades);
    const costs         = costProfile(trades);
    const recFactor     = recoveryFactor(totalPnl, maxDd);
    const rRisk         = rRiskProfile(rMs);
    const stop          = stopQuality(trades);

    // Execution (Tier B) — recorded by MetaTrader rather than inferred from P&L.
    const exitReasons   = byExitReason(trades);
    const magicData     = byMagic(trades);
    const legData       = legStats(trades);
    const cashFlow      = externalCashFlow(trades);

    // Research layer. These read the review fields and the market context the
    // exporter now records, so a book with none of it still renders — just
    // with empty adherence panels instead of fabricated ones.
    const adherence     = adherenceStats(trades);
    const mistakes      = mistakeTagStats(trades);
    const versions      = setupVersionStats(trades);

    return {
      wins, losses, totalPnl, winRate, avgWin, avgLoss, profitFactor,
      equityCurve, equityDomain, initBal, daily, sharpe, sortino, calmar, exp,
      maxDd, maxDdPct, longestDdDays, currentDdDays, ddCurve,
      rHistogram, avgR, rolling, dowData, hourData, streak,
      riskCoverage: risked.length, riskCoveragePct: trades.length > 0 ? (risked.length / trades.length) * 100 : 0,
      avgRisk, minRisk, maxRisk, riskConsistency, riskPctAvg, riskPctVals, stopBreaches, riskMissing, rUnit,
      bestTrade, worstTrade, symbolData, tagData, tradingDays,
      hasMaeMfe, avgMae, avgMfe, entryEff, exitEff, tradeEff, maeMfeChart, maeFdCount: maeFdTrades.length,
      overtradingDays, revengeCount: revenge.count, revengePnl: revenge.revengePnl, revengeOtherPnl: revenge.otherPnl, disciplineScore, meanDailyTrades, maxDayTrades, sdDailyTrades,
      durationData, gapData, directionData, costs, recFactor, rRisk, stop,
      exitReasons, magicData, legData, cashFlow,
      adherence, mistakes, versions,
    };
  }, [trades, allTrades, activeAccount, settings.weekStart]);

  return { trades, allTrades, stats, hasRange, dateFrom, dateTo, symbolFilter, clearDateRange };
}

// The headline figures a trader checks before reading anything else. The set is
// deliberately small: net result, edge, survival risk, and the two halves of
// the edge (hit rate and payoff). Anecdotes like best/worst trade belong lower.
export function OverviewMetrics({ stats }: {
  stats: NonNullable<ReturnType<typeof useAnalyticsSummary>["stats"]>;
}) {
  const totalTrades = stats.riskCoverage + stats.riskMissing;
  // Per-trade expectancy across every trade, so breakeven scratches dilute it
  // the same way they dilute avgR. `stats.exp` excludes scratches and would
  // describe a different population.
  const perTrade = totalTrades > 0 ? stats.totalPnl / totalTrades : 0;
  const returnPct = stats.initBal > 0 ? (stats.totalPnl / stats.initBal) * 100 : null;
  const payoff = stats.avgLoss > 0 ? stats.avgWin / stats.avgLoss : 0;
  const grossWins = stats.avgWin * stats.wins.length;
  const grossLosses = stats.avgLoss * stats.losses.length;
  const pfLabel = stats.profitFactor >= 99 ? "∞" : stats.profitFactor.toFixed(2);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginBottom: "32px" }}>
      <MetricCard
        label={tr("Net P&L")}
        value={`${stats.totalPnl >= 0 ? "+" : ""}${fmtMoney(stats.totalPnl, 2)}`}
        positive={stats.totalPnl >= 0}
        icon={TrendingUp}
        sub={tr(returnPct === null
          ? `${totalTrades} trades · set an initial balance`
          : `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(2)}% of ${fmtMoneyRaw(stats.initBal.toLocaleString())}`)}
      />
      <MetricCard
        label={tr("Expectancy")}
        value={`${stats.avgR >= 0 ? "+" : ""}${stats.avgR.toFixed(2)}R`}
        positive={stats.avgR > 0}
        icon={Activity}
        sub={tr(`${perTrade >= 0 ? "+" : ""}${fmtMoney(perTrade, 2)} per trade · BE = 0R`)}
      />
      <MetricCard
        label={tr("Profit Factor")}
        value={pfLabel}
        positive={stats.profitFactor >= 1}
        icon={Zap}
        sub={tr(`${fmtMoney(grossWins, 0)} gross win / ${fmtMoney(grossLosses, 0)} gross loss`)}
      />
      <MetricCard
        label={tr("Drawdown")}
        value={stats.maxDdPct === 0 ? "0.00%" : `-${Math.abs(stats.maxDdPct).toFixed(2)}%`}
        positive={false}
        neutral={stats.maxDdPct === 0}
        icon={TrendingDown}
        sub={tr(stats.currentDdDays > 0
          ? `${fmtMoney(Math.abs(stats.maxDd), 0)} peak-to-trough · ${stats.currentDdDays}d current`
          : `${fmtMoney(Math.abs(stats.maxDd), 0)} peak-to-trough · at high-water mark`)}
      />
      <MetricCard
        label={tr("Risk per Trade")}
        value={stats.riskPctAvg > 0 ? `${stats.riskPctAvg.toFixed(2)}%` : "—"}
        neutral
        icon={Shield}
        sub={tr(stats.avgRisk <= 0
          ? "Add a stop loss to size risk"
          : stats.initBal <= 0
          ? `${fmtMoney(stats.avgRisk, 0)} average risk · set an initial balance`
          : `${fmtMoney(stats.avgRisk, 0)} average · ${stats.riskCoverage}/${totalTrades} sized`)}
      />
      <MetricCard
        label={tr("Win Rate")}
        value={`${stats.winRate.toFixed(1)}%`}
        positive={stats.profitFactor > 1}
        neutral={stats.profitFactor === 1}
        icon={Target}
        sub={tr(`${payoff.toFixed(2)}:1 payoff · ${stats.wins.length}W/${stats.losses.length}L`)}
      />
    </div>
  );
}

// Compact hold-time label: minutes under an hour, otherwise hours, dropping
// trailing ".0" so the axis stays short and never overlaps.
function formatHoldMinutes(m: number): string {
  if (m < 60) return `${Math.round(m)}m`;
  const h = m / 60;
  return h < 10 ? `${h.toFixed(1).replace(/\.0$/, "")}h` : `${Math.round(h)}h`;
}

// Hold time vs P&L scatter. Each dot is one trade: x is the hold in minutes, y
// is the realised P&L. Winning and losing trades are split by colour so you can
// see whether longer holds actually pay out, or whether you are cutting runners
// by closing too early.
function HoldVsProfitScatter({ trades }: { trades: Trade[] }) {
  const points = useMemo(() => {
    return trades
      .filter((t) => t.durationMin != null && t.durationMin > 0)
      .map((t) => ({
        x: t.durationMin!,
        y: t.pnl,
        win: t.status === "win",
      }));
  }, [trades]);

  if (points.length === 0) return null;

  return (
    <SectionCard title={tr("Hold Time vs P&L")} subtitle={tr("Each dot is one trade. Longer holds should justify the time — if not, you are cut early or the runner is not there.")}>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis
            type="number"
            dataKey="x"
            tick={axisStyle}
            axisLine={false}
            tickLine={false}
            tickCount={7}
            tickFormatter={(v: number) => formatHoldMinutes(v)}
            label={{ value: "Hold time", position: "insideBottom", offset: -12, fill: "var(--text-secondary)", fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            tick={axisStyle}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${fmtMoneyRaw(v)}`}
            width={64}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ strokeDasharray: "3 3" }}
            formatter={(v) => [`${fmtMoney(Number(v), 2)}`, "P&L"]}
            labelFormatter={(v) => `Hold ${formatHoldMinutes(Number(v))}`}
          />
          <ReferenceLine y={0} stroke="var(--text-secondary)" strokeDasharray="4 4" strokeWidth={1} />
          <Scatter name="Winning" fill="var(--profit)" data={points.filter((p) => p.win)} />
          <Scatter name="Losing" fill="var(--loss)" data={points.filter((p) => !p.win)} />
        </ScatterChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

// The Analytics body. It renders below the Dashboard cards rather than on its
// own page, so it deliberately carries no page header of its own.
export default function AnalyticsSections() {
  const { trades, allTrades, stats, hasRange, dateFrom, dateTo, symbolFilter, clearDateRange } = useAnalyticsSummary();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [riskPct, setRiskPct]     = useState(2);
  const [heatmapMetric, setHeatmapMetric] = useState<"pnl" | "winrate" | "count">("pnl");

  const clearRange = clearDateRange;

  // RoR interactive — outside useMemo
  const rorData = (() => {
    if (!stats) return null;
    const b = stats.avgLoss > 0 ? stats.avgWin / stats.avgLoss : 1;
    const p = stats.winRate / 100;
    const q = 1 - p;
    const kelly = Math.max(0, (p * b - q) / b) * 100;
    const edgeN = (p * b - q) / Math.max(p * b + q, 0.001);
    const f   = riskPct / 100;
    const ror = edgeN <= 0
      ? 100
      : Math.min(100, Math.pow((1 - edgeN) / (1 + edgeN), 1 / f) * 100);
    const maxSafeRisk = kelly * 0.5;
    return { kelly: parseFloat(kelly.toFixed(1)), ror: parseFloat(ror.toFixed(2)), maxSafeRisk: parseFloat(maxSafeRisk.toFixed(1)), edgeN };
  })();

  // Recommendations for every tab. Explicit mapping rather than a spread, so
  // the facts the rules read are named here and a rename upstream is a type
  // error instead of a silently empty panel.
  const insights = useMemo(() => {
    if (!stats) return null;
    return buildInsights({
      trades,
      totalPnl: stats.totalPnl,
      winRate: stats.winRate,
      avgWin: stats.avgWin,
      avgLoss: stats.avgLoss,
      profitFactor: stats.profitFactor,
      expectancy: stats.exp,
      tradingDays: stats.tradingDays,

      sharpe: stats.sharpe,
      sortino: stats.sortino,
      calmar: stats.calmar,
      maxDd: stats.maxDd,
      maxDdPct: stats.maxDdPct,
      longestDdDays: stats.longestDdDays,
      currentDdDays: stats.currentDdDays,

      rolling: stats.rolling,

      riskCoverage: stats.riskCoverage,
      riskMissing: stats.riskMissing,
      avgRisk: stats.avgRisk,
      riskPctAvg: stats.riskPctAvg,
      riskConsistency: stats.riskConsistency,
      stopBreaches: stats.stopBreaches,

      daily: stats.daily,
      dowData: stats.dowData,
      hourData: stats.hourData,
      symbolData: stats.symbolData,
      tagData: stats.tagData,

      hasMaeMfe: stats.hasMaeMfe,
      maeFdCount: stats.maeFdCount,
      avgMae: stats.avgMae,
      avgMfe: stats.avgMfe,
      entryEff: stats.entryEff,
      exitEff: stats.exitEff,

      overtradingDays: stats.overtradingDays,
      revengeCount: stats.revengeCount,
      revengePnl: stats.revengePnl,
      otherPnl: stats.revengeOtherPnl,
      disciplineScore: stats.disciplineScore,
      maxDayTrades: stats.maxDayTrades,

      ror: rorData ? { kelly: rorData.kelly, ror: rorData.ror, maxSafeRisk: rorData.maxSafeRisk } : null,
      riskPct,

      recFactor: stats.recFactor,
      rRisk: stats.rRisk,
      costs: stats.costs,
      stop: stats.stop,
      durationData: stats.durationData,
      gapData: stats.gapData,
      directionData: stats.directionData,
      exitReasons: stats.exitReasons,
      magicData: stats.magicData,
      legData: stats.legData,
      cashFlow: stats.cashFlow,

      adherence: stats.adherence,
      mistakes: stats.mistakes,
      versions: stats.versions,
    });
  }, [stats, trades, rorData, riskPct]);

  // One lookup per tab. The guidance mode decides whether the tab shows the
  // findings, only the benchmark scales, or nothing — the panel does the rest.
  const sectionInsights = (section: SectionId) =>
    insights && settings.guidance !== "off" ? (
      <InsightPanel
        insights={insights[section] ?? []}
        mode={settings.guidance === "benchmarks" ? "benchmarks" : "full"}
      />
    ) : null;

  if (trades.length === 0) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", flexDirection: "column", gap: "16px" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: "var(--accent-green-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BarChart2 size={28} color="var(--accent-green)" />
          </div>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
              {tr(hasRange ? "No trades in this range" : "No trades yet")}
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: hasRange ? "16px" : 0 }}>
              {tr(hasRange
                ? `Nothing was traded between ${dateFrom || "the start"} and ${dateTo || "today"}.`
                : "Import trades to unlock analytics")}
            </p>
            {hasRange && (
              <button
                onClick={clearRange}
                style={{
                  padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border)",
                  background: "transparent", color: "var(--text-primary)", fontSize: "13px",
                  fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                }}
              >
                {tr("Clear date range")}</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const rorColor = rorData
    ? rorData.ror < 5 ? "var(--profit)" : rorData.ror < 20 ? "var(--warning)" : "var(--loss)"
    : "var(--text-secondary)";

  return (
    <div>
      {/* Scope line: which slice of the journal every tab below describes. */}
      <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "16px" }}>
        {tr("Showing")}{" "}<strong style={{ color: "var(--text-secondary)" }}>{trades.length}</strong>
        {tr(allTrades.length !== trades.length ? ` of ${allTrades.length}` : "")} {tr("trade")}{tr(trades.length !== 1 ? "s" : "")} · {stats.tradingDays} {tr("trading days")}{tr(symbolFilter ? ` · ${symbolFilter}` : "")}
        {tr(hasRange && (dateFrom || dateTo) ? ` · ${dateFrom || "start"} to ${dateTo || "today"}` : "")}
      </p>

      {/* Tabs */}
      {/* Sticky so switching tabs does not require scrolling back to the top
          of a long analytics body. */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, display: "flex", gap: "4px", marginBottom: "24px", background: "var(--bg-card)", borderRadius: "10px", padding: "4px", border: "1px solid var(--border)", width: "fit-content", flexWrap: "wrap" }}>
        <Tab label={tr("Overview")}    active={activeTab === "overview"}    onClick={() => setActiveTab("overview")} />
        <Tab label={tr("Risk")}        active={activeTab === "risk"}        onClick={() => setActiveTab("risk")} />
        <Tab label={tr("Time")}        active={activeTab === "time"}        onClick={() => setActiveTab("time")} />
        <Tab label={tr("Heatmap")}     active={activeTab === "heatmap"}     onClick={() => setActiveTab("heatmap")} />
        <Tab label={tr("Execution")}   active={activeTab === "execution"}   onClick={() => setActiveTab("execution")} />
        <Tab label={tr("Behavior")}    active={activeTab === "behavior"}    onClick={() => setActiveTab("behavior")} />
        <Tab label={tr("Process")}     active={activeTab === "process"}     onClick={() => setActiveTab("process")} />
        <Tab label={tr("Compare")}     active={activeTab === "compare"}     onClick={() => setActiveTab("compare")} />
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <>
          {sectionInsights("overview")}
          <SectionCard title={tr("Equity Curve")} subtitle={tr(`Starts at ${stats.initBal.toLocaleString()}, axis scaled to your trade range`)}>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={stats.equityCurve}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--profit)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--profit)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis
                  tick={axisStyle}
                  axisLine={false}
                  tickLine={false}
                  domain={stats.equityDomain}
                  tickFormatter={(v: number) => `${fmtMoneyRaw(Math.round(v).toLocaleString())}`}
                  width={68}
                />
                <ReferenceLine
                  y={stats.initBal}
                  stroke="var(--text-secondary)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{ value: "Start", position: "insideTopLeft", fill: "var(--text-secondary)", fontSize: 12 }}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`${fmtMoney(v, 2)}`, "Equity"]) as any} />
                <Area type="monotone" dataKey="equity" stroke="var(--profit)" strokeWidth={2} fill="url(#equityGrad)" dot={false} activeDot={{ r: 4, fill: "var(--profit)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </SectionCard>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
            <SectionCard title={tr("P&L by Symbol")}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.symbolData.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="symbol" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`${fmtMoney(v, 2)}`, "P&L"]) as any} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {stats.symbolData.map((e) => <Cell key={e.symbol} fill={e.pnl >= 0 ? "var(--profit)" : "var(--loss)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>

            {stats.tagData.length > 0 ? (
              <SectionCard title={tr("P&L by Tag")}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.tagData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="tag" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`${fmtMoney(v, 2)}`, "P&L"]) as any} />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {stats.tagData.map((e) => <Cell key={e.tag} fill={e.pnl >= 0 ? "var(--profit)" : "var(--loss)"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            ) : (
              <SectionCard title={tr("Win / Loss Breakdown")}>
                <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={[{ name: tr("Wins"), value: stats.wins.length }, { name: tr("Losses"), value: stats.losses.length }]}
                        cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                        <Cell fill="var(--profit)" />
                        <Cell fill="var(--loss)" />
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>{tr("Wins")}</div>
                      <div style={{ fontSize: "26px", fontWeight: "800", color: "var(--profit)" }}>{stats.wins.length}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{tr("Avg +")}{currencySign()}{stats.avgWin.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>{tr("Losses")}</div>
                      <div style={{ fontSize: "26px", fontWeight: "800", color: "var(--loss)" }}>{stats.losses.length}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{tr("Avg -")}{currencySign()}{stats.avgLoss.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            )}
          </div>

          <HoldVsProfitScatter trades={trades} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", marginTop: "20px" }}>
            <MetricCard label={tr("Max Win Streak")}  value={`${stats.streak.maxWinStreak}`} positive neutral={stats.streak.maxWinStreak === 0} icon={TrendingUp} sub={tr("Consecutive wins")} />
            <MetricCard label={tr("Max Loss Streak")} value={`${stats.streak.maxLossStreak}`} positive={stats.streak.maxLossStreak <= 2} icon={TrendingDown} sub={tr("Consecutive losses")} />
            <MetricCard
              label={tr("Current Streak")}
              value={`${stats.streak.currentStreak}${stats.streak.currentType === "win" ? "W" : stats.streak.currentType === "loss" ? "L" : ""}`}
              positive={stats.streak.currentType === "win"}
              neutral={stats.streak.currentType === null}
              icon={Activity}
              sub={tr(stats.streak.currentType === "win" ? "Winning" : stats.streak.currentType === "loss" ? "Losing" : "—")}
            />
            <MetricCard label={tr("Trades / Day")} value={(trades.length / Math.max(stats.tradingDays, 1)).toFixed(1)} neutral icon={Clock} sub={tr("Avg per trading day")} />
          </div>
        </>
      )}

      {/* Risk */}
      {activeTab === "risk" && (
        <>
          {sectionInsights("risk")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "20px" }}>
            <MetricCard label={tr("Sharpe Ratio")}  value={stats.sharpe.toFixed(2)}  positive={stats.sharpe > 1}  neutral={stats.sharpe === 0}  icon={Activity}
              sub={tr(stats.sharpe > 2 ? "Excellent" : stats.sharpe > 1 ? "Good" : stats.sharpe > 0 ? "Below avg" : "N/A (<5 days)")} />
            <MetricCard label={tr("Sortino Ratio")} value={stats.sortino.toFixed(2)} positive={stats.sortino > 1} neutral={stats.sortino === 0} icon={TrendingUp}
              sub={tr(stats.sortino > 2 ? "Strong downside protection" : stats.sortino > 1 ? "Acceptable" : "Review loss management")} />
            <MetricCard label={tr("Calmar Ratio")}  value={stats.calmar === 0 ? "N/A" : stats.calmar.toFixed(2)} positive={stats.calmar > 1} neutral={stats.calmar === 0} icon={Zap} sub={tr("Annualized return / Max DD")} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "20px" }}>
            <MetricCard label={tr("Max Drawdown")}       value={`${fmtMoney(Math.abs(stats.maxDd), 2)}`} positive={false} neutral={stats.maxDd === 0} icon={TrendingDown}
              sub={tr(stats.maxDdPct !== 0 ? `${stats.maxDdPct.toFixed(2)}% from peak` : "No drawdown")} />
            <MetricCard label={tr("Max DD Duration")}    value={stats.longestDdDays === 0 ? "0 days" : `${stats.longestDdDays}d`} positive={stats.longestDdDays < 7} neutral={stats.longestDdDays === 0} icon={Calendar} sub={tr("Longest peak → recovery")} />
            <MetricCard label={tr("Current DD Duration")} value={stats.currentDdDays === 0 ? "None" : `${stats.currentDdDays}d`} positive={stats.currentDdDays === 0} icon={AlertTriangle}
              sub={tr(stats.currentDdDays > 0 ? "Still in drawdown" : "At or above high water mark")} />
          </div>

          {stats.riskCoverage > 0 ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", marginBottom: "20px" }}>
                <MetricCard label={tr("Planned Risk")}   value={`${fmtMoney(stats.avgRisk, 2)}`} neutral={false} positive={stats.riskPctAvg <= 2} icon={Shield}
                  sub={tr(`${stats.riskPctAvg.toFixed(2)}% of balance per trade`)} />
                <MetricCard label={tr("Risk Range")}     value={`${fmtMoney(stats.minRisk, 0)} – ${fmtMoney(stats.maxRisk, 0)}`} neutral icon={SlidersHorizontal}
                  sub={tr("Smallest to largest stop")} />
                <MetricCard label={tr("Risk Consistency")} value={`${stats.riskConsistency.toFixed(0)}%`} positive={stats.riskConsistency >= 80} neutral={stats.riskConsistency === 0} icon={Target}
                  sub={tr(stats.riskConsistency >= 80 ? "Sizing is deliberate" : "Sizing drifts between trades")} />
                <MetricCard label={tr("Stop Breaches")}  value={String(stats.stopBreaches)} positive={stats.stopBreaches === 0} neutral={stats.stopBreaches === 0} icon={AlertTriangle}
                  sub={tr(stats.stopBreaches === 0 ? "No loss exceeded planned risk" : "Losses past planned risk")} />
              </div>

              <SectionCard title={tr("Risk Per Trade")} subtitle={tr("Dollars committed at entry, from the stop loss recorded in MetaTrader. A flat band means consistent sizing.")}>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={stats.riskPctVals.map((pct, i) => ({ i, pct }))}>
                    <defs>
                      <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="i" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} unit="%" width={56} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(2)}%`, "Risk"]} />
                    <Area type="stepAfter" dataKey="pct" stroke="var(--accent-blue)" strokeWidth={2} fill="url(#riskGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </SectionCard>
            </>
          ) : (
            <SectionCard title={tr("Planned Risk")}>
              <div style={{ textAlign: "center", padding: "24px 16px" }}>
                <Shield size={22} color="var(--text-secondary)" style={{ marginBottom: "10px" }} />
                <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "440px", margin: "0 auto" }}>
                  {tr("None of these trades have a stop loss recorded. Set a stop on your MetaTrader positions and re-run QuantEdgeExport.mq5 to unlock risk sizing, risk consistency, and true R-multiples instead of an average-loss estimate.")}</p>
              </div>
            </SectionCard>
          )}

          <SectionCard title={tr("Drawdown Over Time")} subtitle={tr("% deviation from the rolling equity high-water mark. Zero = new all-time high.")}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats.ddCurve}>
                <defs>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--loss)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--loss)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`${v.toFixed(2)}%`, "Drawdown"]) as any} />
                <ReferenceLine y={0} stroke="var(--profit)" strokeDasharray="4 4" strokeWidth={1} />
                <Area type="monotone" dataKey="dd" stroke="var(--loss)" strokeWidth={2} fill="url(#ddGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </SectionCard>

          {stats.rolling.length > 0 && (
            <SectionCard title={tr("Rolling 20-Trade Win Rate")} subtitle={tr("Win rate over a sliding window of 20 trades. Reveals consistency trends.")}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats.rolling}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="trade" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`${v}%`, "Win Rate"]) as any} />
                  <ReferenceLine y={50} stroke="var(--text-secondary)" strokeDasharray="4 4" strokeWidth={1} />
                  <Line type="monotone" dataKey="wr" stroke="var(--accent-blue)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          <SectionCard title={tr("Metric Definitions")}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
              {[
                { name: tr("Sharpe Ratio"),  formula: "(Mean Daily P&L / Std Dev Daily P&L) × √252", what: tr("Risk-adjusted return per unit of total volatility. >1 = good, >2 = excellent.") },
                { name: tr("Sortino Ratio"), formula: "(Mean Daily P&L / Downside Std Dev) × √252",  what: tr("Like Sharpe but only penalises downside volatility. More relevant for traders.") },
                { name: tr("Calmar Ratio"),  formula: "Annualized Return % / |Max Drawdown %|",      what: tr("How much return you earn per unit of max drawdown risk. >1 = acceptable.") },
                { name: tr("Expectancy"),    formula: "(Win% × Avg Win) − (Loss% × Avg Loss)",       what: tr("Expected dollar profit per trade. The single most important metric to be positive.") },
              ].map(({ name, formula, what }) => (
                <div key={name} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>{name}</div>
                  <div style={{ fontSize: "10px", fontFamily: "monospace", color: "var(--accent-blue)", background: "rgba(77,159,255,0.08)", padding: "4px 8px", borderRadius: "4px", marginBottom: "8px", overflowX: "auto", whiteSpace: "nowrap" }}>{formula}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5 }}>{what}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}

      {/* Time */}
      {activeTab === "time" && (
        <>
          {sectionInsights("time")}
          <SectionCard title={tr("P&L by Day of Week")} subtitle={tr("Which days are most profitable.")}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "24px" }}>
              {stats.dowData.map(({ day, pnl, count, wr }) => (
                <div key={day} style={{ background: "var(--bg-secondary)", borderRadius: "12px", padding: "16px", borderTop: `3px solid ${pnl >= 0 ? "var(--profit)" : "var(--loss)"}`, textAlign: "center" }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "8px" }}>{day}</div>
                  <div style={{ fontSize: "20px", fontWeight: "800", color: pnl >= 0 ? "var(--profit)" : "var(--loss)", marginBottom: "4px" }}>
                    {tr(pnl >= 0 ? "+" : "")}${pnl.toFixed(0)}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{count}  {tr("trades ·")} {wr}{tr("% WR")}</div>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.dowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`${fmtMoney(v, 2)}`, "Total P&L"]) as any} />
                <ReferenceLine y={0} stroke="var(--text-secondary)" strokeWidth={1} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {stats.dowData.map((e) => <Cell key={e.day} fill={e.pnl >= 0 ? "var(--profit)" : "var(--loss)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title={tr("Daily P&L Distribution")} subtitle={tr("Each bar = one trading day. Reveals consistency vs spike dependency.")}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`${fmtMoney(v, 2)}`, "Daily P&L"]) as any} />
                <ReferenceLine y={0} stroke="var(--text-secondary)" strokeWidth={1} />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                  {stats.daily.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? "var(--profit)" : "var(--loss)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          {stats.tagData.length > 0 && (
            <SectionCard title={tr("Win Rate by Tag")} subtitle={tr("Which setups convert at the highest rate.")}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {stats.tagData.map(({ tag, wr, count, pnl }) => (
                  <div key={tag} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "80px", fontSize: "12px", fontWeight: "600", color: "var(--text-primary)", flexShrink: 0 }}>{tag}</div>
                    <div style={{ flex: 1, background: "var(--bg-secondary)", borderRadius: "4px", height: "8px", overflow: "hidden" }}>
                      <div style={{ width: `${wr}%`, height: "100%", background: wr >= 60 ? "var(--profit)" : wr >= 40 ? "var(--accent-blue)" : "var(--loss)", borderRadius: "4px", transition: "width 0.3s ease" }} />
                    </div>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: wr >= 50 ? "var(--profit)" : "var(--loss)", width: "36px", textAlign: "right" }}>{wr}%</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", width: "70px", textAlign: "right" }}>{count}  {tr("trades")}</div>
                    <div style={{ fontSize: "11px", fontWeight: "600", color: pnl >= 0 ? "var(--profit)" : "var(--loss)", width: "70px", textAlign: "right" }}>
                      {tr(pnl >= 0 ? "+" : "")}${pnl.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* Heatmap */}
      {activeTab === "heatmap" && (
        <>
          {sectionInsights("heatmap")}
          {stats.hourData.length === 0 ? (
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "16px", padding: "60px", textAlign: "center",
            }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "14px",
                background: "var(--accent-green-dim)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
              }}>
                <Clock size={24} color="var(--accent-green)" />
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
                {tr("No time data yet")}</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", maxWidth: "400px", margin: "0 auto" }}>
                {tr("Log entry times on your trades to unlock hour-of-day performance analysis. Entry time is captured automatically on import if your broker CSV includes it.")}</p>
            </div>
          ) : (
            <>
              {/* Stats strip */}
              {(() => {
                const best  = stats.hourData.reduce((b, h) => h.totalPnl > b.totalPnl ? h : b, stats.hourData[0]);
                const worst = stats.hourData.reduce((w, h) => h.totalPnl < w.totalPnl ? h : w, stats.hourData[0]);
                const busiest = stats.hourData.reduce((b, h) => h.count > b.count ? h : b, stats.hourData[0]);
                const withTime = trades.filter((t) => t.hourOfDay != null).length;
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", marginBottom: "24px" }}>
                    <MetricCard label={tr("Hours Tracked")}  value={String(stats.hourData.length)}     neutral icon={Clock}       sub={tr(`${withTime} of ${trades.length} trades`)} />
                    <MetricCard label={tr("Best Hour")}      value={best.label}                         positive icon={TrendingUp}  sub={tr(`+${fmtMoney(best.totalPnl, 0)} · ${best.winRate}% WR`)} />
                    <MetricCard label={tr("Worst Hour")}     value={worst.label}                        positive={false} icon={TrendingDown} sub={tr(`${fmtMoney(worst.totalPnl, 0)} · ${worst.winRate}% WR`)} />
                    <MetricCard label={tr("Busiest Hour")}   value={busiest.label}                      neutral icon={BarChart2}   sub={tr(`${busiest.count} trades`)} />
                  </div>
                );
              })()}

              {/* Metric toggle */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                {([
                  { id: "pnl",     label: tr("Total P&L")  },
                  { id: "winrate", label: tr("Win Rate")    },
                  { id: "count",   label: tr("Trade Count") },
                ] as const).map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setHeatmapMetric(id)}
                    style={{
                      padding: "7px 16px", borderRadius: "20px", border: "1px solid",
                      borderColor: heatmapMetric === id ? "var(--accent-green)" : "var(--border)",
                      background: heatmapMetric === id ? "var(--accent-green-dim)" : "transparent",
                      color: heatmapMetric === id ? "var(--accent-green)" : "var(--text-muted)",
                      fontSize: "12px", fontWeight: "600", cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Bar chart */}
              <SectionCard
                title={tr("Hour-of-Day Performance")}
                subtitle={
                  heatmapMetric === "pnl"
                    ? "Total P&L by hour. Identifies your most and least profitable trading windows."
                    : heatmapMetric === "winrate"
                    ? "Win rate by hour. Reveals which time slots your setups convert best."
                    : "Trade volume by hour. Shows when you are most active."
                }
              >
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stats.hourData} margin={{ bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false}
                      unit={heatmapMetric === "winrate" ? "%" : heatmapMetric === "pnl" ? "" : ""}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={((v: any, _name: any, entry: any) => {
                        const h = entry?.payload;
                        if (!h) return [v, ""];
                        if (heatmapMetric === "pnl")
                          return [`${fmtMoney(v, 2)}`, `${h.count} trades · ${h.winRate}% WR`];
                        if (heatmapMetric === "winrate")
                          return [`${v}%`, `${h.count} trades · ${fmtMoney(h.totalPnl, 0)} P&L`];
                        return [v, `${fmtMoney(h.totalPnl, 0)} · ${h.winRate}% WR`];
                      }) as any}
                    />
                    {heatmapMetric === "pnl" && <ReferenceLine y={0} stroke="var(--text-secondary)" strokeWidth={1} />}
                    <Bar
                      dataKey={heatmapMetric === "pnl" ? "totalPnl" : heatmapMetric === "winrate" ? "winRate" : "count"}
                      radius={[4, 4, 0, 0]}
                    >
                      {stats.hourData.map((h) => {
                        let fill: string;
                        if (heatmapMetric === "pnl")     fill = h.totalPnl >= 0 ? "var(--profit)" : "var(--loss)";
                        else if (heatmapMetric === "winrate") fill = h.winRate >= 60 ? "var(--profit)" : h.winRate >= 40 ? "var(--warning)" : "var(--loss)";
                        else fill = "var(--accent-blue)";
                        return <Cell key={h.hour} fill={fill} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              {/* Hour detail table */}
              <SectionCard title={tr("Breakdown by Hour")}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {stats.hourData.map((h) => (
                    <div key={h.hour} style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "10px 14px", background: "var(--bg-secondary)",
                      borderRadius: "8px",
                    }}>
                      <div style={{ width: "56px", fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", flexShrink: 0 }}>
                        {tr(h.label)}
                      </div>
                      {/* P&L bar */}
                      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ flex: 1, background: "var(--bg-card)", borderRadius: "4px", height: "6px", overflow: "hidden" }}>
                          <div style={{
                            width: `${Math.min(100, Math.abs(h.totalPnl) / Math.max(...stats.hourData.map((x) => Math.abs(x.totalPnl))) * 100)}%`,
                            height: "100%",
                            background: h.totalPnl >= 0 ? "var(--profit)" : "var(--loss)",
                            borderRadius: "4px",
                          }} />
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: "700", color: h.totalPnl >= 0 ? "var(--profit)" : "var(--loss)", width: "72px", textAlign: "right", flexShrink: 0 }}>
                          {tr(h.totalPnl >= 0 ? "+" : "")}${h.totalPnl.toFixed(0)}
                        </div>
                      </div>
                      <div style={{ fontSize: "12px", fontWeight: "600", color: h.winRate >= 50 ? "var(--profit)" : "var(--loss)", width: "44px", textAlign: "center", flexShrink: 0 }}>
                        {h.winRate}{tr("% WR")}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", width: "60px", textAlign: "right", flexShrink: 0 }}>
                        {h.count}  {tr("trade")}{tr(h.count !== 1 ? "s" : "")}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}
        </>
      )}

      {/* Execution */}
      {activeTab === "execution" && (
        <>
          {sectionInsights("execution")}
          {!stats.hasMaeMfe ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "16px", padding: "48px", textAlign: "center" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "var(--accent-green-dim)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Target size={24} color="var(--accent-green)" />
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>{tr("No MAE/MFE data yet")}</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", maxWidth: "400px", margin: "0 auto" }}>
                {tr("Log MAE and MFE on trades using the quick view panel or add trade form.")}</p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
                {stats.maeFdCount}  {tr("of")} {trades.length} {tr("trades have MAE/MFE logged")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", marginBottom: "20px" }}>
                <MetricCard label={tr("Avg MAE")}          value={`${fmtMoney(stats.avgMae, 2)}`}    positive={false} icon={TrendingDown} sub={tr("Avg worst excursion")} />
                <MetricCard label={tr("Avg MFE")}          value={`${fmtMoney(stats.avgMfe, 2)}`}    positive icon={TrendingUp} sub={tr("Avg best excursion")} />
                <MetricCard label={tr("Entry Efficiency")} value={`${stats.entryEff.toFixed(1)}%`}  positive={stats.entryEff >= 60} icon={Target} sub={tr("MFE / (MFE + MAE) — higher is better")} />
                <MetricCard label={tr("Exit Efficiency")}  value={`${stats.exitEff.toFixed(1)}%`}   positive={stats.exitEff >= 60} icon={Zap} sub={tr("PnL / MFE on wins — higher = less left on table")} />
              </div>

              <SectionCard title={tr("MAE vs MFE Per Trade")} subtitle={tr("Each bar pair shows how far the trade went against you (MAE) vs in your favor (MFE).")}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stats.maeMfeChart} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="trade" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={((v: any, name: any) => [`${fmtMoneyRaw(v)}`, name === "mfe" ? "MFE" : "MAE"]) as any}
                    />
                    <Bar dataKey="mfe" fill="var(--profit)" radius={[4, 4, 0, 0]} name="mfe" />
                    <Bar dataKey="mae" fill="var(--loss)" radius={[4, 4, 0, 0]} name="mae" />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              <SectionCard title={tr("How to Use These Numbers")}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
                  {[
                    { name: tr("Entry Efficiency"), formula: "MFE / (MFE + MAE) × 100",        what: tr("Measures how close to the optimal entry price you got. 100% = entered at the exact low for a long. Below 50% means MAE is dominating.") },
                    { name: tr("Exit Efficiency"),  formula: "PnL / MFE × 100 (winning trades)", what: tr("How much of the maximum available gain you captured. Below 60% means leaving money on the table consistently.") },
                    { name: tr("MAE as Risk Proxy"), formula: "Avg MAE vs Avg Loss",            what: tr("If avg MAE >> avg loss, you're stopping out near the worst point. If avg MAE << avg loss, stops may be too tight.") },
                    { name: tr("MFE as Target Proxy"), formula: "Avg MFE vs Avg Win",           what: tr("If avg MFE >> avg win, you're exiting winners far too early. This is where most traders lose their edge.") },
                  ].map(({ name, formula, what }) => (
                    <div key={name} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "14px 16px" }}>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>{name}</div>
                      <div style={{ fontSize: "10px", fontFamily: "monospace", color: "var(--accent-blue)", background: "rgba(77,159,255,0.08)", padding: "4px 8px", borderRadius: "4px", marginBottom: "8px", overflowX: "auto", whiteSpace: "nowrap" }}>{formula}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5 }}>{what}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}

          <ExecutionResearch trades={trades} />
        </>
      )}

      {/* Behavior */}
      {activeTab === "behavior" && (
        <>
          {sectionInsights("behavior")}
          <div style={{ marginBottom: "8px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>{tr("Overtrading Detection")}</h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {tr("Flags days where trade count exceeds your personal baseline by a statistically significant margin.")}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", marginBottom: "20px" }}>
            <MetricCard label={tr("Discipline Score")} value={`${stats.disciplineScore}/100`} positive={stats.disciplineScore >= 70} neutral={stats.disciplineScore === 100} icon={Brain}
              sub={tr(stats.disciplineScore >= 80 ? "Consistent" : stats.disciplineScore >= 60 ? "Some red flags" : "Needs review")} />
            <MetricCard label={tr("Flagged Days")}    value={String(stats.overtradingDays.length)} positive={stats.overtradingDays.length === 0} neutral={stats.overtradingDays.length === 0} icon={AlertTriangle}
              sub={tr(`Threshold: >${Math.round(stats.meanDailyTrades + 1.5 * stats.sdDailyTrades)} trades/day`)} />
            <MetricCard label={tr("Max Single Day")}  value={String(stats.maxDayTrades)} positive={stats.maxDayTrades <= Math.round(stats.meanDailyTrades * 2)} icon={BarChart2}
              sub={tr(`Avg: ${stats.meanDailyTrades.toFixed(1)} trades/day`)} />
            <MetricCard label={tr("Revenge Sequences")} value={String(stats.revengeCount)} positive={stats.revengeCount === 0} neutral={stats.revengeCount === 0} icon={Activity}
              sub={tr("Trades after a loss, same day")} />
          </div>

          {stats.overtradingDays.length > 0 ? (
            <SectionCard title={tr("Flagged Sessions")} subtitle={tr("Days where trade count significantly exceeded your baseline.")}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {stats.overtradingDays.slice(0, 10).map(({ date, count }) => (
                  <div key={date} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px", background: "rgba(255,77,106,0.06)",
                    borderRadius: "10px", border: "1px solid rgba(255,77,106,0.2)",
                  }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>
                        {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {Math.round(((count - stats.meanDailyTrades) / stats.meanDailyTrades) * 100)}{tr("% above your average")}</div>
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--loss)", background: "rgba(255,77,106,0.1)", padding: "4px 12px", borderRadius: "8px" }}>
                      {count} {tr("trades")}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "16px", padding: "14px 16px", background: "var(--bg-secondary)", borderRadius: "10px" }}>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
                  {tr("Overtrading sessions are flagged when your daily count exceeds your mean by 1.5 standard deviations. High-frequency days often produce lower per-trade quality due to fatigue, revenge trading, or deviating from your setup criteria.")}</p>
              </div>
            </SectionCard>
          ) : (
            <div style={{ background: "rgba(0,229,122,0.06)", border: "1px solid rgba(0,229,122,0.2)", borderRadius: "12px", padding: "20px 24px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
              <Shield size={20} color="var(--accent-green)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--accent-green)" }}>{tr("No overtrading detected")}</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{tr("Your daily trade counts are consistent with your baseline.")}</div>
              </div>
            </div>
          )}

          {/* Risk of Ruin */}
          <div style={{ marginBottom: "8px", marginTop: "8px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>{tr("Risk of Ruin Calculator")}</h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {tr("Probability of losing your entire account given your historical edge and position sizing.")}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "20px" }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "16px", padding: "24px" }}>
              <h4 style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "16px" }}>{tr("Inputs")}</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  { label: tr("Win Rate"),     value: `${stats.winRate.toFixed(1)}%`,                                            note: tr("from your trade history") },
                  { label: tr("Avg Win"),      value: `${fmtMoney(stats.avgWin, 2)}`,                                             note: tr("from your trade history") },
                  { label: tr("Avg Loss"),     value: `${fmtMoney(stats.avgLoss, 2)}`,                                            note: tr("from your trade history") },
                  { label: tr("Payoff Ratio"), value: `${(stats.avgWin / Math.max(stats.avgLoss, 0.01)).toFixed(2)}:1`,          note: tr("avg win / avg loss") },
                ].map(({ label, value, note }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: "8px" }}>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>{label}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{note}</div>
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--accent-green)" }}>{value}</div>
                  </div>
                ))}
                <div style={{ padding: "14px", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--accent-green)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>{tr("Risk Per Trade")}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{tr("% of account — adjust to see impact")}</div>
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--accent-green)" }}>{riskPct}%</div>
                  </div>
                  <input
                    type="range" min={0.5} max={25} step={0.5}
                    value={riskPct}
                    onChange={(e) => setRiskPct(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--accent-green)", cursor: "pointer" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
                    <span>0.5%</span><span>25%</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "16px", padding: "24px" }}>
              <h4 style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "16px" }}>{tr("Results")}</h4>
              {rorData && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ padding: "20px", background: "var(--bg-secondary)", borderRadius: "12px", textAlign: "center", border: `1px solid ${rorColor}30` }}>
                    <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.5px", marginBottom: "8px" }}>{tr("RISK OF RUIN")}</div>
                    <div style={{ fontSize: "48px", fontWeight: "800", color: rorColor, lineHeight: 1 }}>
                      {tr(rorData.ror < 0.01 ? "<0.01" : rorData.ror.toFixed(2))}%
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
                      {tr(rorData.ror < 1 ? "Low risk" : rorData.ror < 5 ? "Acceptable" : rorData.ror < 20 ? "Elevated — consider reducing size" : "High — reduce position size")}
                    </div>
                    <div style={{ marginTop: "12px", background: "var(--bg-card)", borderRadius: "6px", height: "8px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, rorData.ror)}%`, height: "100%", background: `linear-gradient(90deg, var(--profit), ${rorColor})`, borderRadius: "6px", transition: "width 0.3s ease" }} />
                    </div>
                  </div>
                  {[
                    { label: tr("Kelly Criterion"),      value: `${rorData.kelly.toFixed(1)}%`,  sub: tr("Theoretically optimal risk fraction"),    color: rorData.kelly > 0 ? "var(--accent-blue)" : "var(--loss)" },
                    { label: tr("Recommended Max Risk"), value: `${rorData.maxSafeRisk.toFixed(1)}%`, sub: tr("Half-Kelly — balances growth and safety"), color: "var(--accent-green)" },
                    {
                      label: tr("Current vs Kelly"),
                      value: riskPct > rorData.kelly && rorData.kelly > 0
                        ? `${((riskPct / rorData.kelly - 1) * 100).toFixed(0)}% above Kelly`
                        : rorData.kelly > 0 ? `${((1 - riskPct / rorData.kelly) * 100).toFixed(0)}% below Kelly` : "—",
                      sub: tr(riskPct > rorData.kelly && rorData.kelly > 0 ? "Over-leveraged relative to your edge" : "Within safe range"),
                      color: riskPct > rorData.kelly && rorData.kelly > 0 ? "var(--loss)" : "var(--profit)",
                    },
                  ].map(({ label, value, sub, color }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: "8px" }}>
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>{label}</div>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{sub}</div>
                      </div>
                      <div style={{ fontSize: "13px", fontWeight: "700", color }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 20px" }}>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
              <strong style={{ color: "var(--text-primary)" }}>{tr("How this is calculated:")}</strong> {tr("Risk of ruin uses the normalized edge from your win rate and payoff ratio to estimate the probability of drawdown to zero. Kelly Criterion gives the theoretically optimal fraction of capital to risk per trade given your edge. Half-Kelly is recommended in practice — it provides ~75% of Kelly growth rate with significantly lower variance and ruin risk.")}</p>
          </div>
        </>
      )}

      {/* Process */}
      {activeTab === "process" && (
        <>
          {sectionInsights("process")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", marginBottom: "20px" }}>
            <MetricCard label={tr("Recovery Factor")} value={stats.recFactor === 0 ? "—" : stats.recFactor.toFixed(2)}
              positive={stats.recFactor >= 3} neutral={stats.recFactor === 0} icon={Activity}
              sub={tr(stats.recFactor >= 3 ? "Earns its drawdown back well" : stats.recFactor >= 1 ? "Just ahead of its drawdown" : "Has not earned back its drawdown")} />
            <MetricCard label={tr("R Std Dev")} value={stats.rRisk.sigma === 0 ? "—" : stats.rRisk.sigma.toFixed(2)}
              neutral icon={BarChart2} sub={tr("Spread of outcomes around your average R")} />
            <MetricCard label={tr("Risk of Ruin (R)")} value={stats.rRisk.sigma === 0 ? "—" : `${(stats.rRisk.ruinApprox * 100).toFixed(2)}%`}
              positive={stats.rRisk.ruinApprox < 0.05} neutral={stats.rRisk.sigma === 0} icon={Shield}
              sub={tr(stats.rRisk.sigma === 0 ? "Needs 3+ trades" : "From your R dispersion, approximate")} />
            <MetricCard label={tr("Costs / Gross Profit")} value={`${stats.costs.costPctOfGross.toFixed(2)}%`}
              positive={stats.costs.costPctOfGross < 10} neutral={stats.costs.costPctOfGross === 0} icon={Zap}
              sub={tr(`${fmtMoney(stats.costs.costs, 2)} total · ${fmtMoney(stats.costs.costPerTrade, 2)}/trade`)} />
          </div>

          <SectionCard title={tr("Outcome by Hold Time")} subtitle={tr("Do your fastest trades pay, or bleed? For a scalper this is often the single most actionable number in the journal.")}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.durationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="bucket" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle}
                  formatter={((v: any, _n: any, p: any) =>
                    [`${fmtMoneyRaw(v)} · ${p.payload.trades} trades · ${p.payload.winRate}% win`, "Net"]) as any} />
                <ReferenceLine y={0} stroke="var(--text-secondary)" strokeWidth={1} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {stats.durationData.map((d, i) => (
                    <Cell key={i} fill={d.pnl >= 0 ? "var(--profit)" : "var(--loss)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", marginTop: "16px" }}>
              {stats.durationData.map((d) => (
                <div key={d.bucket} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "12px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>{d.bucket}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
                    <span>{d.trades}  {tr("trades")}</span><span>{d.winRate}{tr("% win")}</span>
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: "700", marginTop: "6px", color: d.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}>
                    {tr(d.pnl >= 0 ? "+" : "")}${d.pnl.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>{tr(d.avgPnl >= 0 ? "+" : "")}${d.avgPnl.toFixed(2)}  {tr("avg")}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title={tr("Re-entry Timing")} subtitle={tr("Performance by how long after your previous trade you entered, split by whether that previous trade won or lost. Chasing a loser quickly is a distinct habit from trading often.")}>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: "8px 12px", alignItems: "center" }}>
              <div />
              <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{tr("After a win")}</div>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{tr("After a loss")}</div>
              {stats.gapData.map((g) => (
                <Fragment key={g.bucket}>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>{g.bucket}</div>
                  {[g.afterWin, g.afterLoss].map((c) => (
                    <div key={c.bucket} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "9px 12px", background: "var(--bg-secondary)", borderRadius: "8px",
                    }}>
                      {c.trades === 0 ? (
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{tr("no trades")}</span>
                      ) : (
                        <>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{c.trades} · {c.winRate}%W</span>
                          <span style={{ fontSize: "12px", fontWeight: "700", color: c.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}>
                            {tr(c.pnl >= 0 ? "+" : "")}${c.pnl.toFixed(2)}
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
            <div style={{ marginTop: "16px", padding: "14px 16px", background: "var(--bg-secondary)", borderRadius: "10px" }}>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
                {tr("Read the two columns against each other. Fast re-entries after a loss that keep losing are the signature of revenge trading; fast re-entries after a win that hold up are simply momentum. The same gap can mean opposite things depending on which column it sits in.")}</p>
            </div>
          </SectionCard>

          <SectionCard title={tr("Long vs Short")} subtitle={tr("Where your edge actually lives. An asymmetric split is worth knowing even on a small sample.")}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
              {stats.directionData.map((d) => (
                <div key={d.bucket} style={{ background: "var(--bg-secondary)", borderRadius: "12px", padding: "16px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>{d.bucket}</span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{d.trades}  {tr("trade")}{tr(d.trades !== 1 ? "s" : "")}</span>
                  </div>
                  {[
                    { k: "Win rate",      v: `${d.winRate}%`,                              c: "var(--text-primary)" },
                    { k: "Net",           v: `${d.pnl >= 0 ? "+" : ""}${fmtMoney(d.pnl, 2)}`,    c: d.pnl >= 0 ? "var(--profit)" : "var(--loss)" },
                    { k: "Avg per trade", v: `${d.avgPnl >= 0 ? "+" : ""}${fmtMoney(d.avgPnl, 2)}`, c: d.avgPnl >= 0 ? "var(--profit)" : "var(--loss)" },
                  ].map((row) => (
                    <div key={row.k} style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{tr(row.k)}</span>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: row.c }}>{row.v}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </SectionCard>

          {stats.stop.coverage > 0 && (
            <SectionCard title={tr("Stop Quality")} subtitle={tr("How your stop loss actually behaves, from the worst price each trade saw (MAE) against the risk you planned.")}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                <MetricCard label={tr("Avg Excursion")} value={`${stats.stop.avgRatio.toFixed(2)}R`} neutral icon={Target}
                  sub={tr("Worst price vs planned risk")} />
                <MetricCard label={tr("Winners Go Against")} value={`${stats.stop.winnerRatio.toFixed(2)}R`}
                  positive={stats.stop.winnerRatio < 0.5} icon={TrendingUp}
                  sub={tr(`${stats.stop.cleanWinners} of ${stats.stop.wins} stayed under 0.5R`)} />
                <MetricCard label={tr("Losers Reach Stop")} value={`${stats.stop.losersTouchingStop}/${stats.stop.losses}`}
                  positive={false} icon={TrendingDown} sub={tr("Losses that used 90%+ of planned risk")} />
              </div>
              <div style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "14px 16px" }}>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
                  {tr(stats.stop.winnerRatio < 0.5
                    ? "Winners rarely move against you before working, which points to well-timed entries. "
                    : "Winners routinely move against you first, which points to entries taken too early. ")}
                  {tr(stats.stop.losses === 0
                    ? "No losers in this range yet."
                    : stats.stop.losersTouchingStop >= stats.stop.losses * 0.8
                      ? "Losers consistently reach the stop, so stops are being tested rather than pre-empted — risk is set honestly and respected."
                      : "A meaningful share of losers never reach the stop, so some of your exits are discretionary rather than the stop doing the work.")}
                </p>
              </div>
            </SectionCard>
          )}

          {stats.exitReasons.length > 0 && (
            <SectionCard title={tr("How Trades Ended")} subtitle={tr("Why each position closed, straight from MetaTrader's deal reasons. The split between a stop doing its job and a hand closing the trade is the honest measure of how systematic your exits are.")}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.exitReasons}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="bucket" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={((v: any, _n: any, p: any) =>
                      [`${fmtMoneyRaw(v)} · ${p.payload.trades} trades · ${p.payload.winRate}% win`, "Net"]) as any} />
                  <ReferenceLine y={0} stroke="var(--text-secondary)" strokeWidth={1} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {stats.exitReasons.map((d, i) => (
                      <Cell key={i} fill={d.pnl >= 0 ? "var(--profit)" : "var(--loss)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(4, stats.exitReasons.length)}, 1fr)`, gap: "12px", marginTop: "16px" }}>
                {stats.exitReasons.map((d) => (
                  <div key={d.bucket} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "12px 14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>{d.bucket}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
                      <span>{d.trades}  {tr("trades")}</span><span>{d.winRate}{tr("% win")}</span>
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "700", marginTop: "6px", color: d.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}>
                      {tr(d.pnl >= 0 ? "+" : "")}${d.pnl.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {stats.magicData.length > 0 && (
            <SectionCard title={tr("Manual vs Automated")} subtitle={tr("Trades grouped by the magic number that placed them. Zero is your own hand; anything else identifies the expert advisor that opened the trade.")}>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(3, stats.magicData.length)}, 1fr)`, gap: "12px" }}>
                {stats.magicData.map((d) => (
                  <div key={d.bucket} style={{ background: "var(--bg-secondary)", borderRadius: "12px", padding: "16px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>{d.bucket}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{d.trades}  {tr("trade")}{tr(d.trades !== 1 ? "s" : "")}</span>
                    </div>
                    {[
                      { k: "Win rate",      v: `${d.winRate}%`,                              c: "var(--text-primary)" },
                      { k: "Net",           v: `${d.pnl >= 0 ? "+" : ""}${fmtMoney(d.pnl, 2)}`,    c: d.pnl >= 0 ? "var(--profit)" : "var(--loss)" },
                      { k: "Avg per trade", v: `${d.avgPnl >= 0 ? "+" : ""}${fmtMoney(d.avgPnl, 2)}`, c: d.avgPnl >= 0 ? "var(--profit)" : "var(--loss)" },
                    ].map((row) => (
                      <div key={row.k} style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{tr(row.k)}</span>
                        <span style={{ fontSize: "13px", fontWeight: "700", color: row.c }}>{row.v}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {stats.legData.coverage > 0 && (
            <SectionCard title={tr("Position Building")} subtitle={tr("How each position was assembled, from MetaTrader's entry-deal count. One entry is a plan executed; several are a plan changed mid-flight.")}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                {[stats.legData.singleLeg, stats.legData.multiLeg, stats.legData.averagedDown].map((d) => (
                  <div key={d.bucket} style={{ background: "var(--bg-secondary)", borderRadius: "12px", padding: "16px 18px" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "10px" }}>{d.bucket}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
                      <span>{d.trades}  {tr("trade")}{tr(d.trades !== 1 ? "s" : "")}</span><span>{d.winRate}{tr("% win")}</span>
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: "700", marginTop: "8px", color: d.trades === 0 ? "var(--text-muted)" : d.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}>
                      {tr(d.trades === 0 ? "—" : `${d.pnl >= 0 ? "+" : ""}${fmtMoney(d.pnl, 2)}`)}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "14px 16px" }}>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
                  {tr(stats.legData.averagedDown.trades === 0
                    ? "Every position was a single clean entry in this range — no scaling, no adding into a move."
                    : `${stats.legData.averagedDown.trades} position${stats.legData.averagedDown.trades !== 1 ? "s were" : " was"} added to at a worse price than the first entry (${stats.legData.averagedDownPnl >= 0 ? "+" : ""}${fmtMoney(stats.legData.averagedDownPnl, 2)} net). Averaging down widens risk exactly when the market is proving you wrong.`)}
                  {tr(` ${stats.legData.avgLegs.toFixed(2)} entries per position on average.`)}
                </p>
              </div>
            </SectionCard>
          )}

          {stats.cashFlow.coverage >= 2 && (
            <SectionCard title={tr("Account Reconciliation")} subtitle={tr("The exporter records the account balance after every trade. Comparing that to each trade's own P&L shows whether deposits or withdrawals are flattering the equity curve.")}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                <MetricCard label={tr("Net Cash Flow")} value={`${stats.cashFlow.netFlow >= 0 ? "+" : ""}${fmtMoney(stats.cashFlow.netFlow, 2)}`}
                  positive={false} neutral={stats.cashFlow.netFlow === 0} icon={Activity}
                  sub={tr(stats.cashFlow.netFlow === 0 ? "No external cash detected" : "Deposits minus withdrawals")} />
                <MetricCard label={tr("Deposits")} value={`${fmtMoney(stats.cashFlow.deposits, 2)}`} neutral icon={TrendingUp} sub={tr("Cash paid into the account")} />
                <MetricCard label={tr("Withdrawals")} value={`${fmtMoney(Math.abs(stats.cashFlow.withdrawals), 2)}`} neutral icon={TrendingDown} sub={tr("Cash taken out of the account")} />
              </div>
              <div style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "14px 16px" }}>
                {stats.cashFlow.points.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
                    {tr("Every balance change is explained by your own trades, so the trade curve and the account curve are the same thing.")}{tr(" ")}{tr("Reconciled across")} {stats.cashFlow.coverage} {tr("trades.")}</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {stats.cashFlow.points.map((p, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                        <span style={{ color: "var(--text-muted)" }}>{p.date}</span>
                        <span style={{ fontWeight: "700", color: p.flow >= 0 ? "var(--profit)" : "var(--loss)" }}>
                          {tr(p.flow >= 0 ? "+" : "")}${p.flow.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          <SectionCard title={tr("Reading These Numbers")}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
              {[
                { name: tr("Recovery Factor"), formula: "Net Profit / |Max Drawdown|", what: tr("How many times over the account has earned back its worst decline. Above 3 is healthy; below 1 means the drawdown was never recovered by net profit.") },
                { name: tr("R Std Dev"),       formula: "σ of R multiples",            what: tr("How wide your outcomes scatter around the average R. With fixed sizing this dispersion, not the mean, is what determines survival.") },
                { name: tr("Re-entry Gap"),    formula: "entry(n) − exit(n−1)",        what: tr("Time between closing one trade and opening the next. Bucketed and split by the previous result, it separates momentum re-entries from loss-chasing.") },
                { name: tr("Cost Ratio"),      formula: "Costs / Gross Profit × 100",  what: tr("Commission and fees as a share of everything won. Above ~10% it eats the edge for a high-frequency book; below 1% it is noise.") },
                { name: tr("Exit Reason"),     formula: "DEAL_REASON of the closing deal", what: tr("Whether the stop or the target took the trade out, or you closed it by hand. Discretionary exits that cluster on losers is the pattern worth watching.") },
                { name: tr("Magic Number"),    formula: "DEAL_MAGIC (0 = manual)",       what: tr("Separates hand-placed trades from those opened by an expert advisor, so you can see which method actually earns.") },
                { name: tr("Entry Legs"),      formula: "count of DEAL_ENTRY_IN deals",  what: tr("One entry is a plan executed; several are a plan changed mid-flight. Adding at a worse price than the first fill is averaging into a loser.") },
                { name: tr("Reconciliation"),  formula: "Δbalance − trade P&L",          what: tr("Cash the account paid in or took out between trades. Non-zero means the account curve and your trade curve are not the same thing.") },
              ].map(({ name, formula, what }) => (
                <div key={name} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>{name}</div>
                  <div style={{ fontSize: "10px", fontFamily: "monospace", color: "var(--accent-blue)", background: "rgba(77,159,255,0.08)", padding: "4px 8px", borderRadius: "4px", marginBottom: "8px", overflowX: "auto", whiteSpace: "nowrap" }}>{formula}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5 }}>{what}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <AdherencePanel stats={stats} />
        </>
      )}

      {activeTab === "compare" && <CompareTab trades={trades} />}

      </div>
  );
}

// ─── Compare: two cohorts against each other ────────────────────────────
// Every other tab slices one book. Strategy decisions need the opposite
// shape: two specific cohorts, the same unit of risk, and an honest answer
// about whether the gap clears the noise.

type CohortRule =
  | { kind: "all" }
  | { kind: "tag"; value: string }
  | { kind: "direction"; value: string }
  | { kind: "plan"; value: "followed" | "broke" }
  | { kind: "forward" }
  | { kind: "version"; value: number };

function applyRule(trades: Trade[], rule: CohortRule): Trade[] {
  switch (rule.kind) {
    case "all":    return trades;
    case "tag":    return trades.filter((t) => (Array.isArray(t.tags) ? t.tags : []).includes(rule.value));
    case "direction": return trades.filter((t) => (t.direction || "").toLowerCase() === rule.value);
    case "plan":   return trades.filter((t) => t.followedPlan === (rule.value === "followed"));
    case "forward": return trades.filter((t) => t.isForwardTest === true);
    case "version": return trades.filter((t) => t.setupVersion === rule.value);
    default:       return trades;
  }
}

function useCohortOptions(trades: Trade[]) {
  return useMemo(() => {
    const options: { key: string; label: string; rule: CohortRule }[] = [
      { key: "all", label: tr("All trades"), rule: { kind: "all" } },
    ];
    const tags = new Set<string>();
    for (const t of trades) for (const tag of (Array.isArray(t.tags) ? t.tags : [])) tags.add(tag);
    for (const tag of [...tags].sort()) {
      options.push({ key: `tag:${tag}`, label: tr(`Tag · ${tag}`), rule: { kind: "tag", value: tag } });
    }
    if (trades.some((t) => (t.direction || "").toLowerCase() === "long")) {
      options.push({ key: "dir:long", label: tr("Direction · Long"), rule: { kind: "direction", value: "long" } });
    }
    if (trades.some((t) => (t.direction || "").toLowerCase() === "short")) {
      options.push({ key: "dir:short", label: tr("Direction · Short"), rule: { kind: "direction", value: "short" } });
    }
    if (trades.some((t) => t.followedPlan === true)) {
      options.push({ key: "plan:followed", label: tr("Reviewed · Followed the plan"), rule: { kind: "plan", value: "followed" } });
    }
    if (trades.some((t) => t.followedPlan === false)) {
      options.push({ key: "plan:broke", label: tr("Reviewed · Broke the plan"), rule: { kind: "plan", value: "broke" } });
    }
    if (trades.some((t) => t.isForwardTest === true)) {
      options.push({ key: "forward", label: tr("Forward test trades"), rule: { kind: "forward" } });
    }
    const versions = [...new Set(trades.map((t) => t.setupVersion).filter((v): v is number => v != null))].sort((a, b) => a - b);
    for (const v of versions) {
      options.push({ key: `v:${v}`, label: tr(`Setup version ${v}`), rule: { kind: "version", value: v } });
    }
    return options;
  }, [trades]);
}

function CompareRow({ label, a, b, hint }: { label: string; a: string; b: string; hint?: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "10px", padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
      <div>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{label}</div>
        {hint && <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px" }}>{hint}</div>}
      </div>
      <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", textAlign: "right" }}>{a}</div>
      <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", textAlign: "right" }}>{b}</div>
    </div>
  );
}

function CompareTab({ trades }: { trades: Trade[] }) {
  const options = useCohortOptions(trades);
  const firstTag = options.find((o) => o.key.startsWith("tag:"))?.key;
  const [aKey, setAKey] = useState<string>(firstTag ?? "all");
  const [bKey, setBKey] = useState<string>("all");

  const { A, B, verdict } = useMemo(() => {
    const aRule = options.find((o) => o.key === aKey)?.rule ?? ({ kind: "all" } as CohortRule);
    const bRule = options.find((o) => o.key === bKey)?.rule ?? ({ kind: "all" } as CohortRule);
    const aTrades = applyRule(trades, aRule);
    const bTrades = applyRule(trades, bRule);
    // One shared 1R unit, or "expectancy in R" would mean two different things.
    const unit = riskUnit([...aTrades, ...bTrades]);
    const a = cohortStats(options.find((o) => o.key === aKey)?.label ?? "A", aTrades, unit);
    const b = cohortStats(options.find((o) => o.key === bKey)?.label ?? "B", bTrades, unit);
    return { A: a, B: b, verdict: compareCohorts(a, b) };
  }, [trades, aKey, bKey, options]);

  const pctText = (v: number) => `${v.toFixed(1)}%`;
  const ciText = (ci: { low: number; high: number } | null, unit = "%") =>
    ci ? `${ci.low.toFixed(1)}–${ci.high.toFixed(1)}${unit}` : "—";

  const verdictStyle =
    verdict.verdict === "a" ? { color: "var(--profit)", bg: "rgba(0,229,122,0.10)", border: "rgba(0,229,122,0.35)" }
    : verdict.verdict === "b" ? { color: "var(--warning)", bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.35)" }
    : { color: "var(--text-secondary)", bg: "var(--bg-secondary)", border: "var(--border)" };

  const verdictText =
    verdict.verdict === "a"
      ? `${A.label} carries the higher expectancy, and the intervals do not overlap.`
      : verdict.verdict === "b"
        ? `${B.label} carries the higher expectancy, and the intervals do not overlap.`
        : verdict.verdict === "indistinguishable"
          ? `A ${Math.abs(verdict.gapR).toFixed(2)}R gap, but the two intervals overlap — this is not a difference you can act on yet.`
          : `Not enough trades on both sides to compare. Each cohort needs at least 20.`;

  const selectStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", borderRadius: "8px",
    border: "1px solid var(--border)", background: "var(--bg-secondary)",
    color: "var(--text-primary)", fontSize: "12px",
    fontFamily: "'DM Sans', sans-serif",
  };

  return (
    <>
      <SectionCard
        title={tr("Cohort comparison")}
        subtitle={tr("Pick two slices of the same book. Both are measured in the same 1R unit, and the verdict only separates them when the bootstrap intervals do not overlap.")}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <div>
            <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>{tr("Cohort A")}</label>
            <select value={aKey} onChange={(e) => setAKey(e.target.value)} style={selectStyle}>
              {options.map((o) => <option key={o.key} value={o.key}>{tr(o.label)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>{tr("Cohort B")}</label>
            <select value={bKey} onChange={(e) => setBKey(e.target.value)} style={selectStyle}>
              {options.map((o) => <option key={o.key} value={o.key}>{tr(o.label)}</option>)}
            </select>
          </div>
        </div>

        <div style={{ background: verdictStyle.bg, border: `1px solid ${verdictStyle.border}`, borderRadius: "10px", padding: "12px 14px", marginBottom: "16px" }}>
          <div style={{ fontSize: "13px", fontWeight: "700", color: verdictStyle.color }}>{verdictText}</div>
          {verdict.neededPerCohort != null && verdict.verdict !== "a" && verdict.verdict !== "b" && (
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              {tr("About")}{verdict.neededPerCohort} {tr("trades per cohort would settle it at this effect size.")}</div>
          )}
        </div>

        <CompareRow label={tr("Trades")} a={String(A.trades)} b={String(B.trades)} />
        <CompareRow label={tr("Win rate")} a={pctText(A.winRate)} b={pctText(B.winRate)} hint={`A 95% ${ciText(A.winRateCI)} · B ${ciText(B.winRateCI)}`} />
        <CompareRow label={tr("Expectancy")} a={`${A.expectancyR >= 0 ? "+" : ""}${A.expectancyR.toFixed(2)}R`} b={`${B.expectancyR >= 0 ? "+" : ""}${B.expectancyR.toFixed(2)}R`} hint={`A 95% ${ciText(A.expectancyCI, "R")} · B ${ciText(B.expectancyCI, "R")}`} />
        <CompareRow label={tr("Net P&L")} a={`${A.totalPnl >= 0 ? "+" : ""}${fmtMoney(A.totalPnl, 0)}`} b={`${B.totalPnl >= 0 ? "+" : ""}${fmtMoney(B.totalPnl, 0)}`} />
        <CompareRow label={tr("Profit factor")} a={A.profitFactor == null ? "—" : A.profitFactor.toFixed(2)} b={B.profitFactor == null ? "—" : B.profitFactor.toFixed(2)} />
        <CompareRow label={tr("MFE capture")} a={A.mfeCapture == null ? "—" : `${A.mfeCapture.toFixed(0)}%`} b={B.mfeCapture == null ? "—" : `${B.mfeCapture.toFixed(0)}%`} hint={tr("Share of the favourable move kept on winners")} />
        <CompareRow label={tr("Plan adherence")} a={A.adherence == null ? "—" : `${A.adherence.toFixed(0)}%`} b={B.adherence == null ? "—" : `${B.adherence.toFixed(0)}%`} hint={A.reviewed + B.reviewed > 0 ? `${A.reviewed + B.reviewed} reviewed trades` : "Review trades to populate"} />
      </SectionCard>

      <SectionCard title={tr("Reading a comparison")} subtitle={tr("What the numbers can and cannot tell you at this sample size.")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
          {[
            { name: tr("Shared 1R unit"), what: tr("Both cohorts divide P&L by the same risk unit, so R means the same thing on both sides. Comparing raw expectancy in dollars across different position sizes would just measure size.") },
            { name: tr("Bootstrap interval"), what: tr("Each expectancy is resampled 2,000 times to show how much it could move on another run of similar trades. Non-overlapping intervals are the minimum bar for a difference.") },
            { name: tr("Trades needed"), what: tr("An estimate of the sample required to detect this gap with 80% power. If it is larger than your journal, the honest move is to collect more trades rather than change the rules.") },
          ].map(({ name, what }) => (
            <div key={name} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "14px 16px" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>{name}</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.6 }}>{what}</div>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

// ─── Adherence: did the trader do what the plan said? ───────────────────
// Same trader, same market, two behaviours. This is the most actionable
// comparison in the app because nothing about the instrument changes.

function AdherencePanel({ stats }: {
  stats: NonNullable<ReturnType<typeof useAnalyticsSummary>["stats"]>;
}) {
  const a = stats.adherence;
  const mistakes = stats.mistakes;
  const versions = stats.versions;

  const cell: React.CSSProperties = { fontSize: "12px", padding: "7px 8px", textAlign: "right" };
  const head: React.CSSProperties = { fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", padding: "0 8px 6px", textAlign: "right" };

  if (a.reviewed === 0 && versions.length === 0 && mistakes.length === 0) {
    return (
      <SectionCard title={tr("Plan adherence")} subtitle={tr("The gap between following your rules and breaking them, measured in R.")}>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
          {tr("No trade has been reviewed yet. Open a trade from the Calendar or Dashboard and record whether it followed the plan in the quick view panel — until then this comparison (the cheapest edge most books have) cannot be measured.")}</p>
      </SectionCard>
    );
  }

  return (
    <>
      <SectionCard title={tr("Plan adherence")} subtitle={tr("Trades you reviewed, split by whether you did what the plan said. Both sides use the same 1R unit.")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          <MetricCard label={tr("Reviewed")} value={`${a.reviewed}`} neutral icon={Shield} sub={tr(`${a.followed} on plan · ${a.broke} off plan`)} />
          <MetricCard label={tr("On-plan expectancy")} value={a.followedExpectancyR == null ? "—" : `${a.followedExpectancyR >= 0 ? "+" : ""}${a.followedExpectancyR.toFixed(2)}R`} positive={(a.followedExpectancyR ?? 0) >= 0} icon={Target} sub={tr("Average per trade")} />
          <MetricCard label={tr("Off-plan expectancy")} value={a.brokeExpectancyR == null ? "—" : `${a.brokeExpectancyR >= 0 ? "+" : ""}${a.brokeExpectancyR.toFixed(2)}R`} positive={(a.brokeExpectancyR ?? 0) >= 0} icon={AlertTriangle} sub={tr("Average per trade")} />
          <MetricCard label={tr("Cost per break")} value={a.costPerBreak == null ? "—" : `${a.costPerBreak <= 0 ? "-" : "+"}${fmtMoney(Math.abs(a.costPerBreak), 0)}`} positive={a.costPerBreak != null && a.costPerBreak >= 0} icon={TrendingDown} sub={tr("Against the on-plan baseline")} />
        </div>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
          {tr(a.reviewed < 10
            ? `Only ${a.reviewed} reviewed trades so far — treat this as a direction, not a verdict. Ten is the floor before the gap means anything.`
            : `Across ${a.reviewed} reviewed trades, on-plan work earned ${a.followedPnl >= 0 ? "+" : ""}${fmtMoney(a.followedPnl, 0)} and breaks ${a.brokePnl >= 0 ? "+" : ""}${fmtMoney(a.brokePnl, 0)}.`)}
        </p>
      </SectionCard>

      {mistakes.length > 0 && (
        <SectionCard title={tr("Logged mistakes")} subtitle={tr("Worst first, by expectancy. A tag repeated three times is a habit, not an accident.")}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 90px 110px 110px", minWidth: "480px" }}>
              <div style={{ ...head, textAlign: "left" }}>{tr("Mistake")}</div>
              <div style={head}>{tr("Trades")}</div>
              <div style={head}>{tr("Win rate")}</div>
              <div style={head}>{tr("Expectancy")}</div>
              <div style={head}>{tr("Net P&L")}</div>
              {mistakes.map((m) => (
                <Fragment key={m.tag}>
                  <div style={{ ...cell, textAlign: "left", color: "var(--text-primary)", fontWeight: "600" }}>{m.tag}</div>
                  <div style={{ ...cell, color: "var(--text-secondary)" }}>{m.count}</div>
                  <div style={{ ...cell, color: "var(--text-secondary)" }}>{m.winRate.toFixed(0)}%</div>
                  <div style={{ ...cell, color: m.expectancyR >= 0 ? "var(--profit)" : "var(--loss)", fontWeight: "700" }}>{tr(m.expectancyR >= 0 ? "+" : "")}{m.expectancyR.toFixed(2)}R</div>
                  <div style={{ ...cell, color: m.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}>{tr(m.pnl >= 0 ? "+" : "-")}${Math.abs(m.pnl).toFixed(0)}</div>
                </Fragment>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      {versions.length > 0 && (
        <SectionCard title={tr("Setup revisions")} subtitle={tr("The same rules before and after each change. Judge a revision on this table, not on how it felt.")}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
            {versions.map((v) => (
              <div key={v.version} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "12px 14px" }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>{tr("Version")} {v.version}</div>
                <div style={{ fontSize: "18px", fontWeight: "800", color: v.expectancyR >= 0 ? "var(--profit)" : "var(--loss)" }}>
                  {tr(v.expectancyR >= 0 ? "+" : "")}{v.expectancyR.toFixed(2)}R
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                  {v.count}  {tr("trade")}{tr(v.count !== 1 ? "s" : "")} · {v.winRate.toFixed(0)}{tr("% wins ·")} {tr(v.pnl >= 0 ? "+" : "-")}${Math.abs(v.pnl).toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </>
  );
}

// ─── Execution research: exits, stops and the reward the plan asked for ──

function ExecutionResearch({ trades }: { trades: Trade[] }) {
  const capture = useMemo(() => mfeCaptureBuckets(trades), [trades]);
  const atr = useMemo(() => stopVsAtr(trades), [trades]);
  const rr = useMemo(() => outcomeByIntendedRR(trades), [trades]);

  const hasCapture = capture.some((b) => b.count > 0);
  const hasAtr = atr.some((b) => b.count > 0);
  const hasRr = rr.some((b) => b.count > 0);
  if (!hasCapture && !hasAtr && !hasRr) return null;

  const cell: React.CSSProperties = { fontSize: "12px", padding: "7px 8px", textAlign: "right", color: "var(--text-secondary)" };
  const head: React.CSSProperties = { fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", padding: "0 8px 6px", textAlign: "right" };

  return (
    <>
      {hasCapture && (
        <SectionCard title={tr("How much of the move you keep")} subtitle={tr("Winners bucketed by P&L as a share of the best excursion the trade reached. A cluster at the left is an exit problem, not an entry problem.")}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${capture.length}, 1fr)`, gap: "10px" }}>
            {capture.map((b) => (
              <div key={b.label} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "12px 10px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>{tr(b.label)}</div>
                <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-primary)" }}>{b.count}</div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
                  {tr(b.count > 0 ? `avg ${b.avgCapture.toFixed(0)}%` : "—")}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {hasAtr && (
        <SectionCard title={tr("Stop distance in ATR")} subtitle={tr("Planned risk per unit divided by ATR(14) at entry. Stops inside half an ATR are inside the noise of the instrument.")}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 90px 100px 120px", minWidth: "420px" }}>
            <div style={{ ...head, textAlign: "left" }}>{tr("Stop band")}</div>
            <div style={head}>{tr("Trades")}</div>
            <div style={head}>{tr("Win rate")}</div>
            <div style={head}>{tr("Expectancy")}</div>
            {atr.map((b) => (
              <Fragment key={b.label}>
                <div style={{ ...cell, textAlign: "left", color: "var(--text-primary)" }}>{tr(b.label)}</div>
                <div style={cell}>{b.count}</div>
                <div style={cell}>{tr(b.count > 0 ? `${b.winRate.toFixed(0)}%` : "—")}</div>
                <div style={{ ...cell, fontWeight: "700", color: b.count === 0 ? "var(--text-muted)" : b.expectancyR >= 0 ? "var(--profit)" : "var(--loss)" }}>
                  {tr(b.count > 0 ? `${b.expectancyR >= 0 ? "+" : ""}${b.expectancyR.toFixed(2)}R` : "—")}
                </div>
              </Fragment>
            ))}
          </div>
        </SectionCard>
      )}

      {hasRr && (
        <SectionCard title={tr("Outcome by intended R:R")} subtitle={tr("The reward the plan asked for against what the trades actually produced something in.")}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 90px 100px 120px", minWidth: "420px" }}>
            <div style={{ ...head, textAlign: "left" }}>{tr("Planned R:R")}</div>
            <div style={head}>{tr("Trades")}</div>
            <div style={head}>{tr("Win rate")}</div>
            <div style={head}>{tr("Expectancy")}</div>
            {rr.map((b) => (
              <Fragment key={b.label}>
                <div style={{ ...cell, textAlign: "left", color: "var(--text-primary)" }}>{tr(b.label)}</div>
                <div style={cell}>{b.count}</div>
                <div style={cell}>{tr(b.count > 0 ? `${b.winRate.toFixed(0)}%` : "—")}</div>
                <div style={{ ...cell, fontWeight: "700", color: b.count === 0 ? "var(--text-muted)" : b.expectancyR >= 0 ? "var(--profit)" : "var(--loss)" }}>
                  {tr(b.count > 0 ? `${b.expectancyR >= 0 ? "+" : ""}${b.expectancyR.toFixed(2)}R` : "—")}
                </div>
              </Fragment>
            ))}
          </div>
        </SectionCard>
      )}
    </>
  );
}
