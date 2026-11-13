"use client";
import { t as tr } from "../lib/i18n";
import { useMemo } from "react";
import { Upload, ShieldCheck, ShieldAlert } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useSettings } from "../hooks/useSettings";
import { Trade } from "../lib/types";
import AnalyticsSections, { OverviewMetrics, useAnalyticsSummary } from "../components/AnalyticsSections";

// Daily Risk Controls Strip 
function DailyRiskStrip({ trades }: { trades: Trade[] }) {
  const { settings } = useSettings();
  const { dailyLossLimit, maxDailyTrades } = settings;

  // Local date, not toISOString(): UTC rolls over at a different hour than the
  // trader's session, which made "today" show the wrong day near midnight.
  const now      = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // ALL hooks must run before any conditional return
  const todayTrades = useMemo(() => {
    return trades.filter((t) => {
      const raw = t.date;
      let normalized = raw;
      if (raw.includes("/")) {
        const [mm, dd, yyyy] = raw.split("/");
        normalized = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
      }
      return normalized === todayKey;
    });
  }, [trades, todayKey]);

  // No controls configured — render nothing (after hooks)
  if (!dailyLossLimit && !maxDailyTrades) return null;

  const todayPnl      = todayTrades.reduce((s, t) => s + t.pnl, 0);
  const todayLoss     = Math.min(todayPnl, 0);
  const todayCount    = todayTrades.length;

  const lossUsedPct   = dailyLossLimit > 0
    ? Math.min(100, (Math.abs(todayLoss) / dailyLossLimit) * 100)
    : 0;
  const tradeUsedPct  = maxDailyTrades > 0
    ? Math.min(100, (todayCount / maxDailyTrades) * 100)
    : 0;

  const lossBreached  = dailyLossLimit > 0 && Math.abs(todayLoss) >= dailyLossLimit;
  const tradeBreached = maxDailyTrades > 0 && todayCount >= maxDailyTrades;
  const lossWarning   = !lossBreached  && lossUsedPct  >= 75;
  const tradeWarning  = !tradeBreached && tradeUsedPct >= 75;

  const anyBreached = lossBreached || tradeBreached;
  const anyWarning  = !anyBreached && (lossWarning || tradeWarning);

  const borderColor = anyBreached
    ? "rgba(255,77,106,0.5)"
    : anyWarning
    ? "rgba(251,191,36,0.4)"
    : "rgba(0,229,122,0.2)";

  const bgColor = anyBreached
    ? "rgba(255,77,106,0.06)"
    : anyWarning
    ? "rgba(251,191,36,0.05)"
    : "rgba(0,229,122,0.04)";

  const StatusIcon  = anyBreached ? ShieldAlert : ShieldCheck;
  const statusColor = anyBreached ? "var(--loss)" : anyWarning ? "var(--warning)" : "var(--profit)";

  return (
    <div style={{
      background: bgColor, border: `1px solid ${borderColor}`,
      borderRadius: "12px", padding: "14px 18px", marginBottom: "24px",
      display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <StatusIcon size={16} color={statusColor} />
        <span style={{ fontSize: "12px", fontWeight: "700", color: statusColor }}>
          {tr(anyBreached ? "Limit Reached" : anyWarning ? "Approaching Limit" : "Within Limits")}
        </span>
      </div>

      <div style={{ width: "1px", height: "28px", background: "var(--border)", flexShrink: 0 }} />

      {dailyLossLimit > 0 && (
        <div style={{ flex: 1, minWidth: "180px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.3px" }}>
              {tr("DAILY LOSS")}</span>
            <span style={{
              fontSize: "11px", fontWeight: "700",
              color: lossBreached ? "var(--loss)" : lossWarning ? "var(--warning)" : "var(--text-muted)",
            }}>
              ${Math.abs(todayLoss).toFixed(2)} / ${dailyLossLimit.toFixed(2)}
            </span>
          </div>
          <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${lossUsedPct}%`,
              background: lossBreached ? "var(--loss)" : lossWarning ? "var(--warning)" : "var(--profit)",
              borderRadius: "4px", transition: "width 0.3s ease",
            }} />
          </div>
        </div>
      )}

      {maxDailyTrades > 0 && (
        <div style={{ flex: 1, minWidth: "180px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.3px" }}>
              {tr("TRADES TODAY")}</span>
            <span style={{
              fontSize: "11px", fontWeight: "700",
              color: tradeBreached ? "var(--loss)" : tradeWarning ? "var(--warning)" : "var(--text-muted)",
            }}>
              {todayCount} / {maxDailyTrades}
            </span>
          </div>
          <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${tradeUsedPct}%`,
              background: tradeBreached ? "var(--loss)" : tradeWarning ? "var(--warning)" : "var(--profit)",
              borderRadius: "4px", transition: "width 0.3s ease",
            }} />
          </div>
        </div>
      )}

      <div style={{ flexShrink: 0, textAlign: "right" }}>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "2px" }}>{tr("TODAY")}</div>
        <div style={{ fontSize: "16px", fontWeight: "800", color: todayPnl >= 0 ? "var(--profit)" : "var(--loss)" }}>
          {tr(todayPnl >= 0 ? "+" : "")}${todayPnl.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { trades: allTrades, setActivePage } = useApp();
  // Same hook the tabbed body below reads, so the headline cards and the
  // Analytics sections can never describe different periods or figures.
  const { trades, stats: summary, hasRange, dateFrom, dateTo, symbolFilter } = useAnalyticsSummary();

  return (
    <>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "26px", fontWeight: "700", color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
          {tr("Dashboard")}</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
          {tr("Your edge, risk and process for the selected market and period")}</p>
      </div>

      {/* Headline figures are period-scoped and only exist once there is a
          period to describe; the import prompt below stands in otherwise. */}
      {summary && <OverviewMetrics stats={summary} />}

      {/* Today's risk limits are a live guardrail, not a period statistic, so
          they sit under the headline cards and deliberately read every trade
          rather than the selected range. Renders only when limits are set. */}
      <DailyRiskStrip trades={allTrades} />

      {/* With no trades in range there are no figures to describe, so the
          import prompt stands in for the analytics body. */}
      {trades.length === 0 ? (
        <div style={{
          background: "var(--bg-card)", border: "1px dashed var(--border)",
          borderRadius: "16px", padding: "60px", textAlign: "center",
        }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "12px",
            background: "var(--accent-green-dim)", display: "flex",
            alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
          }}>
            <Upload size={20} color="var(--accent-green)" />
          </div>
          <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "8px", color: "var(--text-primary)" }}>
            {tr(hasRange || symbolFilter ? "No trades for this selection" : "No trades yet")}
          </h3>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "24px" }}>
            {tr(symbolFilter && hasRange
              ? `Nothing was traded on ${symbolFilter} between ${dateFrom || "the start"} and ${dateTo || "today"}.`
              : symbolFilter
              ? `No ${symbolFilter} trades in this account.`
              : hasRange
              ? `Nothing was traded between ${dateFrom || "the start"} and ${dateTo || "today"}.`
              : "Run the QuantEdge exporter on your MetaTrader terminal, then import the CSV to get started.")}
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
              onClick={() => setActivePage("import")}
              style={{
                padding: "10px 20px", borderRadius: "8px", border: "none",
                background: "var(--accent-green)", color: "#000", fontSize: "13px",
                fontWeight: "600", fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
              }}
            >
              {tr("Import CSV")}</button>
          </div>
        </div>
      ) : (
        <AnalyticsSections />
      )}
    </>
  );
}
