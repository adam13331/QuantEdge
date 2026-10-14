"use client";
import { useState, useMemo, Fragment } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie,
  ReferenceLine, AreaChart, Area,
} from "recharts";
import { useApp } from "../context/AppContext";
import {
  TrendingUp, TrendingDown, Target, Zap, Award, Clock,
  BarChart2, Activity, AlertTriangle, Calendar, Shield, Brain, X, SlidersHorizontal,
} from "lucide-react";

import {
  stdDev, normalizeDate, getDailyPnl, sharpeRatio, sortinoRatio, expectancy,
  calmarRatio, drawdownStats, rMultiples, rHistogram, rollingWinRate,
  byDayOfWeek, byHourOfDay, streaks,
  byDuration, byReEntryGap, byDirection, costProfile, recoveryFactor,
  rRiskProfile, stopQuality, byExitReason, byMagic, legStats, externalCashFlow,
  revengeSequences,
} from "../lib/analytics";
import { buildInsights, type SectionId } from "../lib/insights";
import { SectionCard, MetricCard, InsightPanel } from "../components/AnalyticsCards";
import { useSettings } from "../hooks/useSettings";


function tooltipStyleUnused() {}


const tooltipStyle = {
  background: "#16161f", border: "1px solid #2a2a3a",
  borderRadius: "8px", color: "#f0f0ff", fontSize: "12px",
};
const axisStyle = { fontSize: 12, fill: "#a8a8c8" };

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

type TabId = "overview" | "risk" | "time" | "heatmap" | "rmultiples" | "execution" | "behavior" | "process";

// From/to date filter, matching the Dashboard trade history controls.
function DateRangeFilter({
  dateFrom, dateTo, setDateFrom, setDateTo, onClear, hasRange,
}: {
  dateFrom: string;
  dateTo: string;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  onClear: () => void;
  hasRange: boolean;
}) {
  const inputStyle: React.CSSProperties = {
    padding: "8px 12px", borderRadius: "8px",
    border: "1px solid var(--border)", background: "var(--bg-card)",
    color: "var(--text-primary)", fontSize: "12px", colorScheme: "dark",
    fontFamily: "'DM Sans', sans-serif", outline: "none",
  };

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
        marginBottom: "24px", padding: "12px 16px",
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px",
      }}
    >
      <Calendar size={14} color="var(--text-muted)" />
      <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)" }}>Period</span>

      <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
      <span style={{ fontSize: "12px", color: "#a8a8c8" }}>to</span>
      <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />

      {hasRange && (
        <button
          onClick={onClear}
          style={{
            display: "flex", alignItems: "center", gap: "4px",
            background: "none", border: "none", cursor: "pointer",
            color: "#ff4d6a", fontSize: "12px",
            fontFamily: "'DM Sans', sans-serif", fontWeight: "600",
          }}
        >
          <X size={12} /> Clear
        </button>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const { trades: allTrades, activeAccount } = useApp();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [riskPct, setRiskPct]     = useState(2);
  const [heatmapMetric, setHeatmapMetric] = useState<"pnl" | "winrate" | "count">("pnl");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");

  // Everything below reads `trades`, so scoping it here filters every tab
  // (overview, risk, time, heatmap, R-multiples, execution, behavior) at once.
  const trades = useMemo(() => {
    return allTrades.filter((t) => {
      const d = normalizeDate(t.date);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [allTrades, dateFrom, dateTo]);

  const hasRange = Boolean(dateFrom || dateTo);
  const clearRange = () => { setDateFrom(""); setDateTo(""); };

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
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 99 : 0;

    const initBal = activeAccount?.initialBalance ?? 0;

    // The curve opens on the untouched starting balance rather than on the
    // first trade, so the line starts where the account actually started.
    const equityCurve: { date: string; equity: number; pnl: number }[] = [
      { date: "Start", equity: initBal, pnl: 0 },
    ];
    let running = initBal;
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
    let eqMin = initBal, eqMax = initBal;
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

    const { maxDd, maxDdPct, longestDdDays, currentDdDays, ddCurve } =
      drawdownStats(sorted, initBal);
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
    const dowData = byDayOfWeek(trades);
    const hourData = byHourOfDay(trades);
    const streak  = streaks(trades);

    const bestTrade  = trades.reduce((b, t) => t.pnl > b.pnl ? t : b, trades[0]);
    const worstTrade = trades.reduce((w, t) => t.pnl < w.pnl ? t : w, trades[0]);

    const bySymbol: Record<string, { pnl: number; count: number; wins: number }> = {};
    for (const t of trades) {
      if (!bySymbol[t.underlying]) bySymbol[t.underlying] = { pnl: 0, count: 0, wins: 0 };
      bySymbol[t.underlying].pnl += t.pnl;
      bySymbol[t.underlying].count += 1;
      if (t.status === "win") bySymbol[t.underlying].wins += 1;
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

    const maeMfeChart = maeFdTrades.slice(-20).map((t, i) => ({
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
    };
  }, [trades, activeAccount]);

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

      avgR: stats.avgR,
      rUnit: stats.rUnit,
      rHistogram: stats.rHistogram,

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
    });
  }, [stats, trades, rorData, riskPct]);

  // One lookup per tab, so a section can ask for its own recommendations.
  const insightFor = (section: SectionId) =>
    settings.showRecommendations ? insights?.[section] ?? [] : [];

  if (trades.length === 0) {
    return (
      <div>
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "26px", fontWeight: "700", color: "var(--text-primary)", letterSpacing: "-0.5px", marginBottom: "4px" }}>
            Analytics
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Process, risk and behaviour across every tab</p>
        </div>
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} onClear={clearRange} hasRange={hasRange} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", flexDirection: "column", gap: "16px" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: "var(--accent-green-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BarChart2 size={28} color="var(--accent-green)" />
          </div>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
              {hasRange ? "No trades in this range" : "No trades yet"}
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: hasRange ? "16px" : 0 }}>
              {hasRange
                ? `Nothing was traded between ${dateFrom || "the start"} and ${dateTo || "today"}.`
                : "Import trades to unlock analytics"}
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
                Clear date range
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const rorColor = rorData
    ? rorData.ror < 5 ? "#00e57a" : rorData.ror < 20 ? "#fbbf24" : "#ff4d6a"
    : "#a8a8c8";

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "26px", fontWeight: "700", color: "var(--text-primary)", letterSpacing: "-0.5px", marginBottom: "4px" }}>
          Analytics
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
          {trades.length} trade{trades.length !== 1 ? "s" : ""} · {stats.tradingDays} trading days
          {hasRange && allTrades.length !== trades.length && ` (filtered from ${allTrades.length})`}
        </p>
      </div>

      <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} onClear={clearRange} hasRange={hasRange} />

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", background: "var(--bg-card)", borderRadius: "10px", padding: "4px", border: "1px solid var(--border)", width: "fit-content", flexWrap: "wrap" }}>
        <Tab label="Overview"    active={activeTab === "overview"}    onClick={() => setActiveTab("overview")} />
        <Tab label="Risk"        active={activeTab === "risk"}        onClick={() => setActiveTab("risk")} />
        <Tab label="Time"        active={activeTab === "time"}        onClick={() => setActiveTab("time")} />
        <Tab label="Heatmap"     active={activeTab === "heatmap"}     onClick={() => setActiveTab("heatmap")} />
        <Tab label="R-Multiples" active={activeTab === "rmultiples"}  onClick={() => setActiveTab("rmultiples")} />
        <Tab label="Execution"   active={activeTab === "execution"}   onClick={() => setActiveTab("execution")} />
        <Tab label="Behavior"    active={activeTab === "behavior"}    onClick={() => setActiveTab("behavior")} />
        <Tab label="Process"     active={activeTab === "process"}     onClick={() => setActiveTab("process")} />
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <>
          <InsightPanel insights={insightFor("overview")} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
            <MetricCard label="Total P&L"     value={`${stats.totalPnl >= 0 ? "+" : ""}$${stats.totalPnl.toFixed(2)}`} positive={stats.totalPnl >= 0} icon={TrendingUp} />
            <MetricCard label="Win Rate"      value={`${stats.winRate.toFixed(1)}%`} positive={stats.winRate >= 50} icon={Target} sub={`${stats.wins.length}W · ${stats.losses.length}L`} />
            <MetricCard label="Profit Factor" value={stats.profitFactor.toFixed(2)} positive={stats.profitFactor >= 1} icon={Zap} sub="Avg W / Avg L" />
            <MetricCard label="Expectancy"    value={`${stats.exp >= 0 ? "+" : ""}$${stats.exp.toFixed(2)}`} positive={stats.exp >= 0} icon={Activity} sub="Per trade" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
            <MetricCard label="Avg Win"     value={`+$${stats.avgWin.toFixed(2)}`}  positive icon={Award} />
            <MetricCard label="Avg Loss"    value={`-$${stats.avgLoss.toFixed(2)}`} positive={false} icon={TrendingDown} />
            <MetricCard label="Best Trade"  value={`+$${stats.bestTrade.pnl.toFixed(2)}`} positive icon={Award} sub={stats.bestTrade.underlying} />
            <MetricCard label="Worst Trade" value={`$${stats.worstTrade.pnl.toFixed(2)}`} positive={false} icon={AlertTriangle} sub={stats.worstTrade.underlying} />
          </div>

          <SectionCard title="Equity Curve" subtitle={`Starts at ${stats.initBal.toLocaleString()}, axis scaled to your trade range`}>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={stats.equityCurve}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00e57a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#00e57a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
                <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis
                  tick={axisStyle}
                  axisLine={false}
                  tickLine={false}
                  domain={stats.equityDomain}
                  tickFormatter={(v: number) => `$${Math.round(v).toLocaleString()}`}
                  width={68}
                />
                <ReferenceLine
                  y={stats.initBal}
                  stroke="#a8a8c8"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{ value: "Start", position: "insideTopLeft", fill: "#a8a8c8", fontSize: 12 }}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`$${v.toFixed(2)}`, "Equity"]) as any} />
                <Area type="monotone" dataKey="equity" stroke="#00e57a" strokeWidth={2} fill="url(#equityGrad)" dot={false} activeDot={{ r: 4, fill: "#00e57a" }} />
              </AreaChart>
            </ResponsiveContainer>
          </SectionCard>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <SectionCard title="P&L by Symbol">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.symbolData.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
                  <XAxis dataKey="symbol" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`$${v.toFixed(2)}`, "P&L"]) as any} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {stats.symbolData.map((e) => <Cell key={e.symbol} fill={e.pnl >= 0 ? "#00e57a" : "#ff4d6a"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>

            {stats.tagData.length > 0 ? (
              <SectionCard title="P&L by Tag">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.tagData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
                    <XAxis dataKey="tag" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`$${v.toFixed(2)}`, "P&L"]) as any} />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {stats.tagData.map((e) => <Cell key={e.tag} fill={e.pnl >= 0 ? "#00e57a" : "#ff4d6a"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            ) : (
              <SectionCard title="Win / Loss Breakdown">
                <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={[{ name: "Wins", value: stats.wins.length }, { name: "Losses", value: stats.losses.length }]}
                        cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                        <Cell fill="#00e57a" />
                        <Cell fill="#ff4d6a" />
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ fontSize: "11px", color: "#a8a8c8", marginBottom: "4px" }}>Wins</div>
                      <div style={{ fontSize: "26px", fontWeight: "800", color: "#00e57a" }}>{stats.wins.length}</div>
                      <div style={{ fontSize: "11px", color: "#a8a8c8" }}>Avg +${stats.avgWin.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "#a8a8c8", marginBottom: "4px" }}>Losses</div>
                      <div style={{ fontSize: "26px", fontWeight: "800", color: "#ff4d6a" }}>{stats.losses.length}</div>
                      <div style={{ fontSize: "11px", color: "#a8a8c8" }}>Avg -${stats.avgLoss.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginTop: "20px" }}>
            <MetricCard label="Max Win Streak"  value={`${stats.streak.maxWinStreak}`} positive neutral={stats.streak.maxWinStreak === 0} icon={TrendingUp} sub="Consecutive wins" />
            <MetricCard label="Max Loss Streak" value={`${stats.streak.maxLossStreak}`} positive={stats.streak.maxLossStreak <= 2} icon={TrendingDown} sub="Consecutive losses" />
            <MetricCard
              label="Current Streak"
              value={`${stats.streak.currentStreak}${stats.streak.currentType === "win" ? "W" : stats.streak.currentType === "loss" ? "L" : ""}`}
              positive={stats.streak.currentType === "win"}
              neutral={stats.streak.currentType === null}
              icon={Activity}
              sub={stats.streak.currentType === "win" ? "Winning" : stats.streak.currentType === "loss" ? "Losing" : "—"}
            />
            <MetricCard label="Trades / Day" value={(trades.length / Math.max(stats.tradingDays, 1)).toFixed(1)} neutral icon={Clock} sub="Avg per trading day" />
          </div>
        </>
      )}

      {/* Risk */}
      {activeTab === "risk" && (
        <>
          <InsightPanel insights={insightFor("risk")} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
            <MetricCard label="Sharpe Ratio"  value={stats.sharpe.toFixed(2)}  positive={stats.sharpe > 1}  neutral={stats.sharpe === 0}  icon={Activity}
              sub={stats.sharpe > 2 ? "Excellent" : stats.sharpe > 1 ? "Good" : stats.sharpe > 0 ? "Below avg" : "N/A (<5 days)"} />
            <MetricCard label="Sortino Ratio" value={stats.sortino.toFixed(2)} positive={stats.sortino > 1} neutral={stats.sortino === 0} icon={TrendingUp}
              sub={stats.sortino > 2 ? "Strong downside protection" : stats.sortino > 1 ? "Acceptable" : "Review loss management"} />
            <MetricCard label="Calmar Ratio"  value={stats.calmar === 0 ? "N/A" : stats.calmar.toFixed(2)} positive={stats.calmar > 1} neutral={stats.calmar === 0} icon={Zap} sub="Annualized return / Max DD" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
            <MetricCard label="Max Drawdown"       value={`$${Math.abs(stats.maxDd).toFixed(2)}`} positive={false} neutral={stats.maxDd === 0} icon={TrendingDown}
              sub={stats.maxDdPct !== 0 ? `${stats.maxDdPct.toFixed(2)}% from peak` : "No drawdown"} />
            <MetricCard label="Max DD Duration"    value={stats.longestDdDays === 0 ? "0 days" : `${stats.longestDdDays}d`} positive={stats.longestDdDays < 7} neutral={stats.longestDdDays === 0} icon={Calendar} sub="Longest peak → recovery" />
            <MetricCard label="Current DD Duration" value={stats.currentDdDays === 0 ? "None" : `${stats.currentDdDays}d`} positive={stats.currentDdDays === 0} icon={AlertTriangle}
              sub={stats.currentDdDays > 0 ? "Still in drawdown" : "At or above high water mark"} />
          </div>

          {stats.riskCoverage > 0 ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
                <MetricCard label="Planned Risk"   value={`$${stats.avgRisk.toFixed(2)}`} neutral={false} positive={stats.riskPctAvg <= 2} icon={Shield}
                  sub={`${stats.riskPctAvg.toFixed(2)}% of balance per trade`} />
                <MetricCard label="Risk Range"     value={`$${stats.minRisk.toFixed(0)} – $${stats.maxRisk.toFixed(0)}`} neutral icon={SlidersHorizontal}
                  sub="Smallest to largest stop" />
                <MetricCard label="Risk Consistency" value={`${stats.riskConsistency.toFixed(0)}%`} positive={stats.riskConsistency >= 80} neutral={stats.riskConsistency === 0} icon={Target}
                  sub={stats.riskConsistency >= 80 ? "Sizing is deliberate" : "Sizing drifts between trades"} />
                <MetricCard label="Stop Breaches"  value={String(stats.stopBreaches)} positive={stats.stopBreaches === 0} neutral={stats.stopBreaches === 0} icon={AlertTriangle}
                  sub={stats.stopBreaches === 0 ? "No loss exceeded planned risk" : "Losses past planned risk"} />
              </div>

              <SectionCard title="Risk Per Trade" subtitle="Dollars committed at entry, from the stop loss recorded in MetaTrader. A flat band means consistent sizing.">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={stats.riskPctVals.map((pct, i) => ({ i, pct }))}>
                    <defs>
                      <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4d9fff" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#4d9fff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
                    <XAxis dataKey="i" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} unit="%" width={56} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(2)}%`, "Risk"]} />
                    <Area type="stepAfter" dataKey="pct" stroke="#4d9fff" strokeWidth={2} fill="url(#riskGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </SectionCard>
            </>
          ) : (
            <SectionCard title="Planned Risk">
              <div style={{ textAlign: "center", padding: "24px 16px" }}>
                <Shield size={22} color="#a8a8c8" style={{ marginBottom: "10px" }} />
                <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "440px", margin: "0 auto" }}>
                  None of these trades have a stop loss recorded. Set a stop on your MetaTrader
                  positions and re-run JournedgeExport.mq5 to unlock risk sizing, risk
                  consistency, and true R-multiples instead of an average-loss estimate.
                </p>
              </div>
            </SectionCard>
          )}

          <SectionCard title="Drawdown Over Time" subtitle="% deviation from the rolling equity high-water mark. Zero = new all-time high.">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats.ddCurve}>
                <defs>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff4d6a" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ff4d6a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
                <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`${v.toFixed(2)}%`, "Drawdown"]) as any} />
                <ReferenceLine y={0} stroke="#00e57a" strokeDasharray="4 4" strokeWidth={1} />
                <Area type="monotone" dataKey="dd" stroke="#ff4d6a" strokeWidth={2} fill="url(#ddGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </SectionCard>

          {stats.rolling.length > 0 && (
            <SectionCard title="Rolling 20-Trade Win Rate" subtitle="Win rate over a sliding window of 20 trades. Reveals consistency trends.">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats.rolling}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
                  <XAxis dataKey="trade" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`${v}%`, "Win Rate"]) as any} />
                  <ReferenceLine y={50} stroke="#a8a8c8" strokeDasharray="4 4" strokeWidth={1} />
                  <Line type="monotone" dataKey="wr" stroke="#4d9fff" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          <SectionCard title="Metric Definitions">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {[
                { name: "Sharpe Ratio",  formula: "(Mean Daily P&L / Std Dev Daily P&L) × √252", what: "Risk-adjusted return per unit of total volatility. >1 = good, >2 = excellent." },
                { name: "Sortino Ratio", formula: "(Mean Daily P&L / Downside Std Dev) × √252",  what: "Like Sharpe but only penalises downside volatility. More relevant for traders." },
                { name: "Calmar Ratio",  formula: "Annualized Return % / |Max Drawdown %|",      what: "How much return you earn per unit of max drawdown risk. >1 = acceptable." },
                { name: "Expectancy",    formula: "(Win% × Avg Win) − (Loss% × Avg Loss)",       what: "Expected dollar profit per trade. The single most important metric to be positive." },
              ].map(({ name, formula, what }) => (
                <div key={name} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>{name}</div>
                  <div style={{ fontSize: "10px", fontFamily: "monospace", color: "#4d9fff", background: "rgba(77,159,255,0.08)", padding: "4px 8px", borderRadius: "4px", marginBottom: "8px", overflowX: "auto", whiteSpace: "nowrap" }}>{formula}</div>
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
          <InsightPanel insights={insightFor("time")} />
          <SectionCard title="P&L by Day of Week" subtitle="Which days are most profitable.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "24px" }}>
              {stats.dowData.map(({ day, pnl, count, wr }) => (
                <div key={day} style={{ background: "var(--bg-secondary)", borderRadius: "12px", padding: "16px", borderTop: `3px solid ${pnl >= 0 ? "#00e57a" : "#ff4d6a"}`, textAlign: "center" }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "8px" }}>{day}</div>
                  <div style={{ fontSize: "20px", fontWeight: "800", color: pnl >= 0 ? "#00e57a" : "#ff4d6a", marginBottom: "4px" }}>
                    {pnl >= 0 ? "+" : ""}${pnl.toFixed(0)}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>{count} trades · {wr}% WR</div>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.dowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
                <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`$${v.toFixed(2)}`, "Total P&L"]) as any} />
                <ReferenceLine y={0} stroke="#a8a8c8" strokeWidth={1} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {stats.dowData.map((e) => <Cell key={e.day} fill={e.pnl >= 0 ? "#00e57a" : "#ff4d6a"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Daily P&L Distribution" subtitle="Each bar = one trading day. Reveals consistency vs spike dependency.">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
                <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [`$${v.toFixed(2)}`, "Daily P&L"]) as any} />
                <ReferenceLine y={0} stroke="#a8a8c8" strokeWidth={1} />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                  {stats.daily.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? "#00e57a" : "#ff4d6a"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          {stats.tagData.length > 0 && (
            <SectionCard title="Win Rate by Tag" subtitle="Which setups convert at the highest rate.">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {stats.tagData.map(({ tag, wr, count, pnl }) => (
                  <div key={tag} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "80px", fontSize: "12px", fontWeight: "600", color: "var(--text-primary)", flexShrink: 0 }}>{tag}</div>
                    <div style={{ flex: 1, background: "var(--bg-secondary)", borderRadius: "4px", height: "8px", overflow: "hidden" }}>
                      <div style={{ width: `${wr}%`, height: "100%", background: wr >= 60 ? "#00e57a" : wr >= 40 ? "#4d9fff" : "#ff4d6a", borderRadius: "4px", transition: "width 0.3s ease" }} />
                    </div>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: wr >= 50 ? "#00e57a" : "#ff4d6a", width: "36px", textAlign: "right" }}>{wr}%</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", width: "70px", textAlign: "right" }}>{count} trades</div>
                    <div style={{ fontSize: "11px", fontWeight: "600", color: pnl >= 0 ? "#00e57a" : "#ff4d6a", width: "70px", textAlign: "right" }}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
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
          <InsightPanel insights={insightFor("heatmap")} />
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
                No time data yet
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", maxWidth: "400px", margin: "0 auto" }}>
                Log entry times on your trades to unlock hour-of-day performance analysis. Entry time is captured automatically on import if your broker CSV includes it.
              </p>
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
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
                    <MetricCard label="Hours Tracked"  value={String(stats.hourData.length)}     neutral icon={Clock}       sub={`${withTime} of ${trades.length} trades`} />
                    <MetricCard label="Best Hour"      value={best.label}                         positive icon={TrendingUp}  sub={`+$${best.totalPnl.toFixed(0)} · ${best.winRate}% WR`} />
                    <MetricCard label="Worst Hour"     value={worst.label}                        positive={false} icon={TrendingDown} sub={`$${worst.totalPnl.toFixed(0)} · ${worst.winRate}% WR`} />
                    <MetricCard label="Busiest Hour"   value={busiest.label}                      neutral icon={BarChart2}   sub={`${busiest.count} trades`} />
                  </div>
                );
              })()}

              {/* Metric toggle */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                {([
                  { id: "pnl",     label: "Total P&L"  },
                  { id: "winrate", label: "Win Rate"    },
                  { id: "count",   label: "Trade Count" },
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
                title="Hour-of-Day Performance"
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
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
                          return [`$${v.toFixed(2)}`, `${h.count} trades · ${h.winRate}% WR`];
                        if (heatmapMetric === "winrate")
                          return [`${v}%`, `${h.count} trades · $${h.totalPnl.toFixed(0)} P&L`];
                        return [v, `$${h.totalPnl.toFixed(0)} · ${h.winRate}% WR`];
                      }) as any}
                    />
                    {heatmapMetric === "pnl" && <ReferenceLine y={0} stroke="#a8a8c8" strokeWidth={1} />}
                    <Bar
                      dataKey={heatmapMetric === "pnl" ? "totalPnl" : heatmapMetric === "winrate" ? "winRate" : "count"}
                      radius={[4, 4, 0, 0]}
                    >
                      {stats.hourData.map((h) => {
                        let fill: string;
                        if (heatmapMetric === "pnl")     fill = h.totalPnl >= 0 ? "#00e57a" : "#ff4d6a";
                        else if (heatmapMetric === "winrate") fill = h.winRate >= 60 ? "#00e57a" : h.winRate >= 40 ? "#fbbf24" : "#ff4d6a";
                        else fill = "#4d9fff";
                        return <Cell key={h.hour} fill={fill} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              {/* Hour detail table */}
              <SectionCard title="Breakdown by Hour">
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {stats.hourData.map((h) => (
                    <div key={h.hour} style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "10px 14px", background: "var(--bg-secondary)",
                      borderRadius: "8px",
                    }}>
                      <div style={{ width: "56px", fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", flexShrink: 0 }}>
                        {h.label}
                      </div>
                      {/* P&L bar */}
                      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ flex: 1, background: "var(--bg-card)", borderRadius: "4px", height: "6px", overflow: "hidden" }}>
                          <div style={{
                            width: `${Math.min(100, Math.abs(h.totalPnl) / Math.max(...stats.hourData.map((x) => Math.abs(x.totalPnl))) * 100)}%`,
                            height: "100%",
                            background: h.totalPnl >= 0 ? "#00e57a" : "#ff4d6a",
                            borderRadius: "4px",
                          }} />
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: "700", color: h.totalPnl >= 0 ? "#00e57a" : "#ff4d6a", width: "72px", textAlign: "right", flexShrink: 0 }}>
                          {h.totalPnl >= 0 ? "+" : ""}${h.totalPnl.toFixed(0)}
                        </div>
                      </div>
                      <div style={{ fontSize: "12px", fontWeight: "600", color: h.winRate >= 50 ? "#00e57a" : "#ff4d6a", width: "44px", textAlign: "center", flexShrink: 0 }}>
                        {h.winRate}% WR
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", width: "60px", textAlign: "right", flexShrink: 0 }}>
                        {h.count} trade{h.count !== 1 ? "s" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}
        </>
      )}

      {/* R-Multiples */}
      {activeTab === "rmultiples" && (
        <>
          <InsightPanel insights={insightFor("rmultiples")} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
            <MetricCard label="Avg R-Multiple" value={stats.avgR >= 0 ? `+${stats.avgR.toFixed(2)}R` : `${stats.avgR.toFixed(2)}R`} positive={stats.avgR > 0} icon={Activity} sub="Mean outcome in R-units" />
            <MetricCard
              label={stats.riskCoverage > 0 ? "1R = Planned Risk" : "1R = Avg Loss"}
              value={stats.riskCoverage > 0 ? `$${stats.avgRisk.toFixed(2)}` : `$${stats.avgLoss.toFixed(2)}`}
              neutral icon={Target}
              sub={stats.riskCoverage > 0
                ? `From your stop loss · ${stats.riskCoverage}/${stats.riskCoverage + stats.riskMissing} trades`
                : "Risk proxy (avg loss amount)"}
            />
            <MetricCard
              label="Expectancy"
              value={`${stats.exp >= 0 ? "+" : ""}${(stats.rUnit > 0 ? stats.exp / stats.rUnit : 0).toFixed(2)}R`}
              positive={stats.exp >= 0} icon={Zap} sub="Expected R per trade"
            />
          </div>

          {stats.rHistogram.length > 0 ? (
            <SectionCard title="R-Multiple Distribution" subtitle={stats.riskCoverage > 0
              ? "Distribution of outcomes in R-units, measured against the risk you accepted at entry. Positive skew = good system."
              : "Distribution of outcomes in R-units. 1R = your average loss. Positive skew = good system."}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.rHistogram}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
                  <XAxis dataKey="bucket" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={((v: any) => [v, "Trades"]) as any} />
                  <ReferenceLine x="+0R" stroke="#a8a8c8" strokeDasharray="4 4" />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {stats.rHistogram.map((e) => <Cell key={e.bucket} fill={e.positive ? "#00e57a" : "#ff4d6a"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          ) : (
            <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px", background: "var(--bg-card)", borderRadius: "16px", border: "1px solid var(--border)" }}>
              R-multiple distribution requires at least one losing trade to compute 1R.
            </div>
          )}

          {stats.symbolData.length > 0 && (
            <SectionCard title="Symbol Breakdown" subtitle="P&L, trade count, and win rate per underlying.">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {stats.symbolData.map(({ symbol, pnl, count, wr }) => (
                  <div key={symbol} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", background: "var(--bg-secondary)", borderRadius: "10px", border: "1px solid var(--border)" }}>
                    <div style={{ width: "60px", fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>{symbol}</div>
                    <div style={{ flex: 1, background: "var(--bg-card)", borderRadius: "4px", height: "6px", overflow: "hidden" }}>
                      <div style={{ width: `${wr}%`, height: "100%", background: wr >= 50 ? "#00e57a" : "#ff4d6a", borderRadius: "4px" }} />
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", width: "60px", textAlign: "center" }}>{count} trades</div>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: wr >= 50 ? "#00e57a" : "#ff4d6a", width: "44px", textAlign: "center" }}>{wr}% WR</div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: pnl >= 0 ? "#00e57a" : "#ff4d6a", width: "80px", textAlign: "right" }}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* Execution */}
      {activeTab === "execution" && (
        <>
          <InsightPanel insights={insightFor("execution")} />
          {!stats.hasMaeMfe ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "16px", padding: "48px", textAlign: "center" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "var(--accent-green-dim)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Target size={24} color="var(--accent-green)" />
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>No MAE/MFE data yet</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", maxWidth: "400px", margin: "0 auto" }}>
                Log MAE and MFE on trades using the quick view panel or add trade form.
              </p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
                {stats.maeFdCount} of {trades.length} trades have MAE/MFE logged
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
                <MetricCard label="Avg MAE"          value={`$${stats.avgMae.toFixed(2)}`}    positive={false} icon={TrendingDown} sub="Avg worst excursion" />
                <MetricCard label="Avg MFE"          value={`$${stats.avgMfe.toFixed(2)}`}    positive icon={TrendingUp} sub="Avg best excursion" />
                <MetricCard label="Entry Efficiency" value={`${stats.entryEff.toFixed(1)}%`}  positive={stats.entryEff >= 60} icon={Target} sub="MFE / (MFE + MAE) — higher is better" />
                <MetricCard label="Exit Efficiency"  value={`${stats.exitEff.toFixed(1)}%`}   positive={stats.exitEff >= 60} icon={Zap} sub="PnL / MFE on wins — higher = less left on table" />
              </div>

              <SectionCard title="MAE vs MFE Per Trade" subtitle="Each bar pair shows how far the trade went against you (MAE) vs in your favor (MFE).">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stats.maeMfeChart} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
                    <XAxis dataKey="trade" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={((v: any, name: any) => [`$${v}`, name === "mfe" ? "MFE" : "MAE"]) as any}
                    />
                    <Bar dataKey="mfe" fill="#00e57a" radius={[4, 4, 0, 0]} name="mfe" />
                    <Bar dataKey="mae" fill="#ff4d6a" radius={[4, 4, 0, 0]} name="mae" />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              <SectionCard title="How to Use These Numbers">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  {[
                    { name: "Entry Efficiency", formula: "MFE / (MFE + MAE) × 100",        what: "Measures how close to the optimal entry price you got. 100% = entered at the exact low for a long. Below 50% means MAE is dominating." },
                    { name: "Exit Efficiency",  formula: "PnL / MFE × 100 (winning trades)", what: "How much of the maximum available gain you captured. Below 60% means leaving money on the table consistently." },
                    { name: "MAE as Risk Proxy", formula: "Avg MAE vs Avg Loss",            what: "If avg MAE >> avg loss, you're stopping out near the worst point. If avg MAE << avg loss, stops may be too tight." },
                    { name: "MFE as Target Proxy", formula: "Avg MFE vs Avg Win",           what: "If avg MFE >> avg win, you're exiting winners far too early. This is where most traders lose their edge." },
                  ].map(({ name, formula, what }) => (
                    <div key={name} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "14px 16px" }}>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>{name}</div>
                      <div style={{ fontSize: "10px", fontFamily: "monospace", color: "#4d9fff", background: "rgba(77,159,255,0.08)", padding: "4px 8px", borderRadius: "4px", marginBottom: "8px", overflowX: "auto", whiteSpace: "nowrap" }}>{formula}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5 }}>{what}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}
        </>
      )}

      {/* Behavior */}
      {activeTab === "behavior" && (
        <>
          <InsightPanel insights={insightFor("behavior")} />
          <div style={{ marginBottom: "8px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>Overtrading Detection</h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Flags days where trade count exceeds your personal baseline by a statistically significant margin.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
            <MetricCard label="Discipline Score" value={`${stats.disciplineScore}/100`} positive={stats.disciplineScore >= 70} neutral={stats.disciplineScore === 100} icon={Brain}
              sub={stats.disciplineScore >= 80 ? "Consistent" : stats.disciplineScore >= 60 ? "Some red flags" : "Needs review"} />
            <MetricCard label="Flagged Days"    value={String(stats.overtradingDays.length)} positive={stats.overtradingDays.length === 0} neutral={stats.overtradingDays.length === 0} icon={AlertTriangle}
              sub={`Threshold: >${Math.round(stats.meanDailyTrades + 1.5 * stats.sdDailyTrades)} trades/day`} />
            <MetricCard label="Max Single Day"  value={String(stats.maxDayTrades)} positive={stats.maxDayTrades <= Math.round(stats.meanDailyTrades * 2)} icon={BarChart2}
              sub={`Avg: ${stats.meanDailyTrades.toFixed(1)} trades/day`} />
            <MetricCard label="Revenge Sequences" value={String(stats.revengeCount)} positive={stats.revengeCount === 0} neutral={stats.revengeCount === 0} icon={Activity}
              sub="Trades after a loss, same day" />
          </div>

          {stats.overtradingDays.length > 0 ? (
            <SectionCard title="Flagged Sessions" subtitle="Days where trade count significantly exceeded your baseline.">
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
                        {Math.round(((count - stats.meanDailyTrades) / stats.meanDailyTrades) * 100)}% above your average
                      </div>
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: "800", color: "#ff4d6a", background: "rgba(255,77,106,0.1)", padding: "4px 12px", borderRadius: "8px" }}>
                      {count} trades
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "16px", padding: "14px 16px", background: "var(--bg-secondary)", borderRadius: "10px" }}>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
                  Overtrading sessions are flagged when your daily count exceeds your mean by 1.5 standard deviations.
                  High-frequency days often produce lower per-trade quality due to fatigue, revenge trading, or deviating from your setup criteria.
                </p>
              </div>
            </SectionCard>
          ) : (
            <div style={{ background: "rgba(0,229,122,0.06)", border: "1px solid rgba(0,229,122,0.2)", borderRadius: "12px", padding: "20px 24px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
              <Shield size={20} color="var(--accent-green)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--accent-green)" }}>No overtrading detected</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Your daily trade counts are consistent with your baseline.</div>
              </div>
            </div>
          )}

          {/* Risk of Ruin */}
          <div style={{ marginBottom: "8px", marginTop: "8px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>Risk of Ruin Calculator</h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Probability of losing your entire account given your historical edge and position sizing.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "16px", padding: "24px" }}>
              <h4 style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "16px" }}>Inputs</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  { label: "Win Rate",     value: `${stats.winRate.toFixed(1)}%`,                                            note: "from your trade history" },
                  { label: "Avg Win",      value: `$${stats.avgWin.toFixed(2)}`,                                             note: "from your trade history" },
                  { label: "Avg Loss",     value: `$${stats.avgLoss.toFixed(2)}`,                                            note: "from your trade history" },
                  { label: "Payoff Ratio", value: `${(stats.avgWin / Math.max(stats.avgLoss, 0.01)).toFixed(2)}:1`,          note: "avg win / avg loss" },
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
                      <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>Risk Per Trade</div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>% of account — adjust to see impact</div>
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
              <h4 style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "16px" }}>Results</h4>
              {rorData && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ padding: "20px", background: "var(--bg-secondary)", borderRadius: "12px", textAlign: "center", border: `1px solid ${rorColor}30` }}>
                    <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.5px", marginBottom: "8px" }}>RISK OF RUIN</div>
                    <div style={{ fontSize: "48px", fontWeight: "800", color: rorColor, lineHeight: 1 }}>
                      {rorData.ror < 0.01 ? "<0.01" : rorData.ror.toFixed(2)}%
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
                      {rorData.ror < 1 ? "Low risk" : rorData.ror < 5 ? "Acceptable" : rorData.ror < 20 ? "Elevated — consider reducing size" : "High — reduce position size"}
                    </div>
                    <div style={{ marginTop: "12px", background: "var(--bg-card)", borderRadius: "6px", height: "8px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, rorData.ror)}%`, height: "100%", background: `linear-gradient(90deg, #00e57a, ${rorColor})`, borderRadius: "6px", transition: "width 0.3s ease" }} />
                    </div>
                  </div>
                  {[
                    { label: "Kelly Criterion",      value: `${rorData.kelly.toFixed(1)}%`,  sub: "Theoretically optimal risk fraction",    color: rorData.kelly > 0 ? "#4d9fff" : "#ff4d6a" },
                    { label: "Recommended Max Risk", value: `${rorData.maxSafeRisk.toFixed(1)}%`, sub: "Half-Kelly — balances growth and safety", color: "var(--accent-green)" },
                    {
                      label: "Current vs Kelly",
                      value: riskPct > rorData.kelly && rorData.kelly > 0
                        ? `${((riskPct / rorData.kelly - 1) * 100).toFixed(0)}% above Kelly`
                        : rorData.kelly > 0 ? `${((1 - riskPct / rorData.kelly) * 100).toFixed(0)}% below Kelly` : "—",
                      sub: riskPct > rorData.kelly && rorData.kelly > 0 ? "Over-leveraged relative to your edge" : "Within safe range",
                      color: riskPct > rorData.kelly && rorData.kelly > 0 ? "#ff4d6a" : "#00e57a",
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
              <strong style={{ color: "var(--text-primary)" }}>How this is calculated:</strong> Risk of ruin uses the normalized edge from your win rate and payoff ratio to estimate the probability of drawdown to zero.
              Kelly Criterion gives the theoretically optimal fraction of capital to risk per trade given your edge.
              Half-Kelly is recommended in practice — it provides ~75% of Kelly growth rate with significantly lower variance and ruin risk.
            </p>
          </div>
        </>
      )}

      {/* Process */}
      {activeTab === "process" && (
        <>
          <InsightPanel insights={insightFor("process")} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
            <MetricCard label="Recovery Factor" value={stats.recFactor === 0 ? "—" : stats.recFactor.toFixed(2)}
              positive={stats.recFactor >= 3} neutral={stats.recFactor === 0} icon={Activity}
              sub={stats.recFactor >= 3 ? "Earns its drawdown back well" : stats.recFactor >= 1 ? "Just ahead of its drawdown" : "Has not earned back its drawdown"} />
            <MetricCard label="R Std Dev" value={stats.rRisk.sigma === 0 ? "—" : stats.rRisk.sigma.toFixed(2)}
              neutral icon={BarChart2} sub="Spread of outcomes around your average R" />
            <MetricCard label="Risk of Ruin (R)" value={stats.rRisk.sigma === 0 ? "—" : `${(stats.rRisk.ruinApprox * 100).toFixed(2)}%`}
              positive={stats.rRisk.ruinApprox < 0.05} neutral={stats.rRisk.sigma === 0} icon={Shield}
              sub={stats.rRisk.sigma === 0 ? "Needs 3+ trades" : "From your R dispersion, approximate"} />
            <MetricCard label="Costs / Gross Profit" value={`${stats.costs.costPctOfGross.toFixed(2)}%`}
              positive={stats.costs.costPctOfGross < 10} neutral={stats.costs.costPctOfGross === 0} icon={Zap}
              sub={`$${stats.costs.costs.toFixed(2)} total · $${stats.costs.costPerTrade.toFixed(2)}/trade`} />
          </div>

          <SectionCard title="Outcome by Hold Time" subtitle="Do your fastest trades pay, or bleed? For a scalper this is often the single most actionable number in the journal.">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.durationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
                <XAxis dataKey="bucket" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle}
                  formatter={((v: any, _n: any, p: any) =>
                    [`$${v} · ${p.payload.trades} trades · ${p.payload.winRate}% win`, "Net"]) as any} />
                <ReferenceLine y={0} stroke="#a8a8c8" strokeWidth={1} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {stats.durationData.map((d, i) => (
                    <Cell key={i} fill={d.pnl >= 0 ? "#00e57a" : "#ff4d6a"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginTop: "16px" }}>
              {stats.durationData.map((d) => (
                <div key={d.bucket} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "12px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>{d.bucket}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
                    <span>{d.trades} trades</span><span>{d.winRate}% win</span>
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: "700", marginTop: "6px", color: d.pnl >= 0 ? "#00e57a" : "#ff4d6a" }}>
                    {d.pnl >= 0 ? "+" : ""}${d.pnl.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>{d.avgPnl >= 0 ? "+" : ""}${d.avgPnl.toFixed(2)} avg</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Re-entry Timing" subtitle="Performance by how long after your previous trade you entered, split by whether that previous trade won or lost. Chasing a loser quickly is a distinct habit from trading often.">
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: "8px 12px", alignItems: "center" }}>
              <div />
              <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>After a win</div>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>After a loss</div>
              {stats.gapData.map((g) => (
                <Fragment key={g.bucket}>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>{g.bucket}</div>
                  {[g.afterWin, g.afterLoss].map((c) => (
                    <div key={c.bucket} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "9px 12px", background: "var(--bg-secondary)", borderRadius: "8px",
                    }}>
                      {c.trades === 0 ? (
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>no trades</span>
                      ) : (
                        <>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{c.trades} · {c.winRate}%W</span>
                          <span style={{ fontSize: "12px", fontWeight: "700", color: c.pnl >= 0 ? "#00e57a" : "#ff4d6a" }}>
                            {c.pnl >= 0 ? "+" : ""}${c.pnl.toFixed(2)}
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
                Read the two columns against each other. Fast re-entries after a loss that keep losing are the signature of
                revenge trading; fast re-entries after a win that hold up are simply momentum. The same gap can mean opposite
                things depending on which column it sits in.
              </p>
            </div>
          </SectionCard>

          <SectionCard title="Long vs Short" subtitle="Where your edge actually lives. An asymmetric split is worth knowing even on a small sample.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
              {stats.directionData.map((d) => (
                <div key={d.bucket} style={{ background: "var(--bg-secondary)", borderRadius: "12px", padding: "16px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>{d.bucket}</span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{d.trades} trade{d.trades !== 1 ? "s" : ""}</span>
                  </div>
                  {[
                    { k: "Win rate",      v: `${d.winRate}%`,                              c: "var(--text-primary)" },
                    { k: "Net",           v: `${d.pnl >= 0 ? "+" : ""}$${d.pnl.toFixed(2)}`,    c: d.pnl >= 0 ? "#00e57a" : "#ff4d6a" },
                    { k: "Avg per trade", v: `${d.avgPnl >= 0 ? "+" : ""}$${d.avgPnl.toFixed(2)}`, c: d.avgPnl >= 0 ? "#00e57a" : "#ff4d6a" },
                  ].map((row) => (
                    <div key={row.k} style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{row.k}</span>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: row.c }}>{row.v}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </SectionCard>

          {stats.stop.coverage > 0 && (
            <SectionCard title="Stop Quality" subtitle="How your stop loss actually behaves, from the worst price each trade saw (MAE) against the risk you planned.">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
                <MetricCard label="Avg Excursion" value={`${stats.stop.avgRatio.toFixed(2)}R`} neutral icon={Target}
                  sub="Worst price vs planned risk" />
                <MetricCard label="Winners Go Against" value={`${stats.stop.winnerRatio.toFixed(2)}R`}
                  positive={stats.stop.winnerRatio < 0.5} icon={TrendingUp}
                  sub={`${stats.stop.cleanWinners} of ${stats.stop.wins} stayed under 0.5R`} />
                <MetricCard label="Losers Reach Stop" value={`${stats.stop.losersTouchingStop}/${stats.stop.losses}`}
                  positive={false} icon={TrendingDown} sub="Losses that used 90%+ of planned risk" />
              </div>
              <div style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "14px 16px" }}>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
                  {stats.stop.winnerRatio < 0.5
                    ? "Winners rarely move against you before working, which points to well-timed entries. "
                    : "Winners routinely move against you first, which points to entries taken too early. "}
                  {stats.stop.losses === 0
                    ? "No losers in this range yet."
                    : stats.stop.losersTouchingStop >= stats.stop.losses * 0.8
                      ? "Losers consistently reach the stop, so stops are being tested rather than pre-empted — risk is set honestly and respected."
                      : "A meaningful share of losers never reach the stop, so some of your exits are discretionary rather than the stop doing the work."}
                </p>
              </div>
            </SectionCard>
          )}

          {stats.exitReasons.length > 0 && (
            <SectionCard title="How Trades Ended" subtitle="Why each position closed, straight from MetaTrader's deal reasons. The split between a stop doing its job and a hand closing the trade is the honest measure of how systematic your exits are.">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.exitReasons}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
                  <XAxis dataKey="bucket" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={((v: any, _n: any, p: any) =>
                      [`$${v} · ${p.payload.trades} trades · ${p.payload.winRate}% win`, "Net"]) as any} />
                  <ReferenceLine y={0} stroke="#a8a8c8" strokeWidth={1} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {stats.exitReasons.map((d, i) => (
                      <Cell key={i} fill={d.pnl >= 0 ? "#00e57a" : "#ff4d6a"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(4, stats.exitReasons.length)}, 1fr)`, gap: "12px", marginTop: "16px" }}>
                {stats.exitReasons.map((d) => (
                  <div key={d.bucket} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "12px 14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>{d.bucket}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
                      <span>{d.trades} trades</span><span>{d.winRate}% win</span>
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "700", marginTop: "6px", color: d.pnl >= 0 ? "#00e57a" : "#ff4d6a" }}>
                      {d.pnl >= 0 ? "+" : ""}${d.pnl.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {stats.magicData.length > 0 && (
            <SectionCard title="Manual vs Automated" subtitle="Trades grouped by the magic number that placed them. Zero is your own hand; anything else identifies the expert advisor that opened the trade.">
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(3, stats.magicData.length)}, 1fr)`, gap: "12px" }}>
                {stats.magicData.map((d) => (
                  <div key={d.bucket} style={{ background: "var(--bg-secondary)", borderRadius: "12px", padding: "16px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>{d.bucket}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{d.trades} trade{d.trades !== 1 ? "s" : ""}</span>
                    </div>
                    {[
                      { k: "Win rate",      v: `${d.winRate}%`,                              c: "var(--text-primary)" },
                      { k: "Net",           v: `${d.pnl >= 0 ? "+" : ""}$${d.pnl.toFixed(2)}`,    c: d.pnl >= 0 ? "#00e57a" : "#ff4d6a" },
                      { k: "Avg per trade", v: `${d.avgPnl >= 0 ? "+" : ""}$${d.avgPnl.toFixed(2)}`, c: d.avgPnl >= 0 ? "#00e57a" : "#ff4d6a" },
                    ].map((row) => (
                      <div key={row.k} style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{row.k}</span>
                        <span style={{ fontSize: "13px", fontWeight: "700", color: row.c }}>{row.v}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {stats.legData.coverage > 0 && (
            <SectionCard title="Position Building" subtitle="How each position was assembled, from MetaTrader's entry-deal count. One entry is a plan executed; several are a plan changed mid-flight.">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
                {[stats.legData.singleLeg, stats.legData.multiLeg, stats.legData.averagedDown].map((d) => (
                  <div key={d.bucket} style={{ background: "var(--bg-secondary)", borderRadius: "12px", padding: "16px 18px" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "10px" }}>{d.bucket}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
                      <span>{d.trades} trade{d.trades !== 1 ? "s" : ""}</span><span>{d.winRate}% win</span>
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: "700", marginTop: "8px", color: d.trades === 0 ? "var(--text-muted)" : d.pnl >= 0 ? "#00e57a" : "#ff4d6a" }}>
                      {d.trades === 0 ? "—" : `${d.pnl >= 0 ? "+" : ""}$${d.pnl.toFixed(2)}`}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "14px 16px" }}>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
                  {stats.legData.averagedDown.trades === 0
                    ? "Every position was a single clean entry in this range — no scaling, no adding into a move."
                    : `${stats.legData.averagedDown.trades} position${stats.legData.averagedDown.trades !== 1 ? "s were" : " was"} added to at a worse price than the first entry (${stats.legData.averagedDownPnl >= 0 ? "+" : ""}$${stats.legData.averagedDownPnl.toFixed(2)} net). Averaging down widens risk exactly when the market is proving you wrong.`}
                  {` ${stats.legData.avgLegs.toFixed(2)} entries per position on average.`}
                </p>
              </div>
            </SectionCard>
          )}

          {stats.cashFlow.coverage >= 2 && (
            <SectionCard title="Account Reconciliation" subtitle="The exporter records the account balance after every trade. Comparing that to each trade's own P&L shows whether deposits or withdrawals are flattering the equity curve.">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
                <MetricCard label="Net Cash Flow" value={`${stats.cashFlow.netFlow >= 0 ? "+" : ""}$${stats.cashFlow.netFlow.toFixed(2)}`}
                  positive={false} neutral={stats.cashFlow.netFlow === 0} icon={Activity}
                  sub={stats.cashFlow.netFlow === 0 ? "No external cash detected" : "Deposits minus withdrawals"} />
                <MetricCard label="Deposits" value={`$${stats.cashFlow.deposits.toFixed(2)}`} neutral icon={TrendingUp} sub="Cash paid into the account" />
                <MetricCard label="Withdrawals" value={`$${Math.abs(stats.cashFlow.withdrawals).toFixed(2)}`} neutral icon={TrendingDown} sub="Cash taken out of the account" />
              </div>
              <div style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "14px 16px" }}>
                {stats.cashFlow.points.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
                    Every balance change is explained by your own trades, so the trade curve and the account curve are the same thing.
                    {" "}Reconciled across {stats.cashFlow.coverage} trades.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {stats.cashFlow.points.map((p, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                        <span style={{ color: "var(--text-muted)" }}>{p.date}</span>
                        <span style={{ fontWeight: "700", color: p.flow >= 0 ? "#00e57a" : "#ff4d6a" }}>
                          {p.flow >= 0 ? "+" : ""}${p.flow.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          <SectionCard title="Reading These Numbers">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {[
                { name: "Recovery Factor", formula: "Net Profit / |Max Drawdown|", what: "How many times over the account has earned back its worst decline. Above 3 is healthy; below 1 means the drawdown was never recovered by net profit." },
                { name: "R Std Dev",       formula: "σ of R multiples",            what: "How wide your outcomes scatter around the average R. With fixed sizing this dispersion, not the mean, is what determines survival." },
                { name: "Re-entry Gap",    formula: "entry(n) − exit(n−1)",        what: "Time between closing one trade and opening the next. Bucketed and split by the previous result, it separates momentum re-entries from loss-chasing." },
                { name: "Cost Ratio",      formula: "Costs / Gross Profit × 100",  what: "Commission and fees as a share of everything won. Above ~10% it eats the edge for a high-frequency book; below 1% it is noise." },
                { name: "Exit Reason",     formula: "DEAL_REASON of the closing deal", what: "Whether the stop or the target took the trade out, or you closed it by hand. Discretionary exits that cluster on losers is the pattern worth watching." },
                { name: "Magic Number",    formula: "DEAL_MAGIC (0 = manual)",       what: "Separates hand-placed trades from those opened by an expert advisor, so you can see which method actually earns." },
                { name: "Entry Legs",      formula: "count of DEAL_ENTRY_IN deals",  what: "One entry is a plan executed; several are a plan changed mid-flight. Adding at a worse price than the first fill is averaging into a loser." },
                { name: "Reconciliation",  formula: "Δbalance − trade P&L",          what: "Cash the account paid in or took out between trades. Non-zero means the account curve and your trade curve are not the same thing." },
              ].map(({ name, formula, what }) => (
                <div key={name} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>{name}</div>
                  <div style={{ fontSize: "10px", fontFamily: "monospace", color: "#4d9fff", background: "rgba(77,159,255,0.08)", padding: "4px 8px", borderRadius: "4px", marginBottom: "8px", overflowX: "auto", whiteSpace: "nowrap" }}>{formula}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5 }}>{what}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}

      </div>
  );
}
