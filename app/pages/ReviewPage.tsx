"use client";
import { t as tr } from "../lib/i18n";
import { currencySymbol as currencySign } from "../lib/money";
import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import { weeklyReview, adherenceStats, cohortStats, riskUnit } from "../lib/analytics";
import { useSettings } from "../hooks/useSettings";
import { CalendarCheck, FlaskConical, Shield, TrendingUp } from "lucide-react";

// The weekly ritual. A trading week is read once, against the trader's own
// baseline, and the verdict is deliberately conservative: a week only counts as
// "above" or "below" when its interval clears the baseline, so one good Friday
// does not become a strategy change.

const card: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  padding: "18px 20px",
};

const head: React.CSSProperties = {
  fontSize: "10px",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

export default function ReviewPage() {
  const { trades, allTrades, experiments } = useApp();
  const { settings } = useSettings();

  const weeks = useMemo(() => weeklyReview(trades, 12, settings.weekStart), [trades, settings.weekStart]);
  const adherence = useMemo(() => adherenceStats(trades), [trades]);
  const forward = useMemo(() => {
    const unit = riskUnit(trades);
    const flagged = trades.filter((t) => t.isForwardTest === true);
    const rest = trades.filter((t) => t.isForwardTest !== true);
    return {
      count: flagged.length,
      stats: cohortStats("Forward", flagged, unit),
      baseline: cohortStats("Baseline", rest, unit),
    };
  }, [trades]);

  const running = experiments.filter((e) => e.status === "running");
  const latest = weeks[weeks.length - 1];

  const verdictColour = (v: string) =>
    v === "above" ? "var(--profit)" : v === "below" ? "var(--loss)" : "var(--text-muted)";

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "26px", fontWeight: "700", color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
          {tr("Weekly review")}</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
          {tr("Was the week inside the noise of your own baseline, or did something actually change?")}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <TrendingUp size={14} color="var(--accent-blue)" />
            <span style={head}>{tr("Last week expectancy")}</span>
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: (latest?.expectancyR ?? 0) >= 0 ? "var(--profit)" : "var(--loss)" }}>
            {tr(latest ? `${latest.expectancyR >= 0 ? "+" : ""}${latest.expectancyR.toFixed(2)}R` : "—")}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            {tr(latest
              ? `Baseline ${latest.baselineR == null ? "—" : `${latest.baselineR >= 0 ? "+" : ""}${latest.baselineR.toFixed(2)}R`} · ${latest.trades} trades`
              : "No trades in range")}
          </div>
          {latest && (
            <div style={{ fontSize: "11px", fontWeight: "700", color: verdictColour(latest.verdict), marginTop: "6px" }}>
              {tr(latest.verdict === "above" ? "Above baseline" : latest.verdict === "below" ? "Below baseline" : latest.verdict === "in-line" ? "In line with baseline" : "Not enough trades to judge")}
            </div>
          )}
        </div>

        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <Shield size={14} color="var(--accent-green)" />
            <span style={head}>{tr("Plan adherence")}</span>
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: adherence.adherencePct == null ? "var(--text-muted)" : adherence.adherencePct >= 85 ? "var(--profit)" : "var(--warning)" }}>
            {tr(adherence.adherencePct == null ? "—" : `${adherence.adherencePct.toFixed(0)}%`)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            {tr(adherence.reviewed === 0
              ? "No trades reviewed yet"
              : `${adherence.followed} on plan · ${adherence.broke} off plan`)}
          </div>
        </div>

        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <FlaskConical size={14} color="var(--accent-blue)" />
            <span style={head}>{tr("Forward-test trades")}</span>
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: "var(--text-primary)" }}>{forward.count}</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            {tr(forward.count > 0
              ? `${forward.stats.expectancyR >= 0 ? "+" : ""}${forward.stats.expectancyR.toFixed(2)}R vs ${forward.baseline.expectancyR >= 0 ? "+" : ""}${forward.baseline.expectancyR.toFixed(2)}R baseline`
              : "Mark trades after a rule change to build this cohort")}
          </div>
        </div>

        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <CalendarCheck size={14} color="var(--warning)" />
            <span style={head}>{tr("Running experiments")}</span>
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: "var(--text-primary)" }}>{running.length}</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            {tr(running.length > 0 ? running[0].name : "Start one from the Playbook page")}
          </div>
        </div>
      </div>

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)" }}>{tr("Week by week")}</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
            {tr("Expectancy per week against the average of every trade before that week. The verdict needs at least eight trades and an interval that clears the baseline.")}</div>
        </div>

        {weeks.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
            {tr("No trades in this period. Clear the date filter or import a statement.")}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "120px 70px 90px 110px 100px 130px", minWidth: "640px" }}>
              {["Week of", "Trades", "P&L", "Expectancy", "Adherence", "Verdict"].map((h, i) => (
                <div key={h} style={{ ...head, padding: "10px 14px", textAlign: i === 0 ? "left" : "right" }}>{tr(h)}</div>
              ))}
              {[...weeks].reverse().map((w) => (
                <div key={w.weekStart} style={{ display: "contents" }}>
                  <div style={{ padding: "10px 14px", fontSize: "12px", color: "var(--text-secondary)", borderTop: "1px solid var(--border)" }}>{w.weekStart}</div>
                  <div style={{ padding: "10px 14px", fontSize: "12px", color: "var(--text-secondary)", textAlign: "right", borderTop: "1px solid var(--border)" }}>{w.trades}</div>
                  <div style={{ padding: "10px 14px", fontSize: "12px", fontWeight: "600", textAlign: "right", borderTop: "1px solid var(--border)", color: w.pnl >= 0 ? "var(--profit)" : "var(--loss)" }}>
                    {tr(w.pnl >= 0 ? "+" : "-")}{currencySign()}{Math.abs(w.pnl).toFixed(0)}
                  </div>
                  <div style={{ padding: "10px 14px", fontSize: "12px", fontWeight: "600", textAlign: "right", borderTop: "1px solid var(--border)", color: w.expectancyR >= 0 ? "var(--profit)" : "var(--loss)" }}>
                    {tr(w.expectancyR >= 0 ? "+" : "")}{w.expectancyR.toFixed(2)}R
                  </div>
                  <div style={{ padding: "10px 14px", fontSize: "12px", textAlign: "right", borderTop: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    {tr(w.adherence == null ? "—" : `${w.adherence.toFixed(0)}%`)}
                  </div>
                  <div style={{ padding: "10px 14px", fontSize: "11px", fontWeight: "700", textAlign: "right", borderTop: "1px solid var(--border)", color: verdictColour(w.verdict) }}>
                    {tr(w.verdict === "above" ? "Above baseline" : w.verdict === "below" ? "Below baseline" : w.verdict === "in-line" ? "In line" : "Too few trades")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "16px" }}>
        {trades.length}  {tr("trades in scope")}{tr(allTrades.length !== trades.length ? ` of ${allTrades.length}` : "")}{tr(". Change the period on the Dashboard to review a different window.")}</p>
    </div>
  );
}
