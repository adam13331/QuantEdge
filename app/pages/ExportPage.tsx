"use client";
import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useApp } from "../context/AppContext";
import {
  buildReportStats, ReportStats,
  DEFAULT_CHALLENGE, ChallengeConfig,
  durationMinutes, byDuration, byDirection, costProfile,
  recoveryFactor, rRiskProfile, stopQuality,
  byExitReason, byMagic, legStats, externalCashFlow,
  challengeStatus, simulateChallenge, challengeROI,
} from "../lib/analytics";
import { FileDown, Filter, Layout, Eye, ChevronDown } from "lucide-react";

// Single dynamic import wrapping both PDFDownloadLink and TradingReportPDF
// They must live in the same module boundary — splitting them causes the 'su is not a function' crash
const ExportPDFInner = dynamic(() => import("../components/ExportPDFInner"), {
  ssr: false,
  loading: () => (
    <button disabled style={{
      width: "100%", padding: "12px", borderRadius: "10px",
      border: "none", background: "var(--border)",
      color: "var(--text-muted)", fontSize: "14px", fontWeight: "600",
      cursor: "not-allowed", display: "flex", alignItems: "center",
      justifyContent: "center", gap: "8px",
    }}>
      <FileDown size={16} />
      Loading...
    </button>
  ),
});

// Types
interface ReportOptions {
  // Filters
  dateFrom: string;
  dateTo: string;
  tickers: string[];
  tags: string[];
  status: "all" | "win" | "loss" | "breakeven";

  // Sections
  includeCover: boolean;
  includeStats: boolean;
  includeDailyBreakdown: boolean;
  includeRisk: boolean;
  includeRMultiples: boolean;
  includeExecution: boolean;
  includeProcess: boolean;
  includePropFirm: boolean;
  includeTiming: boolean;
  includeInstruments: boolean;
  includeTradeHistory: boolean;
  includeJournal: boolean;

  // Layout
  journalLayout: "1" | "2" | "4";
}

// Subcomponents
function SectionHeading({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "8px",
      marginBottom: "16px", marginTop: "8px",
    }}>
      <Icon size={14} color="var(--accent-green)" />
      <span style={{
        fontSize: "11px", fontWeight: "700", letterSpacing: "0.8px",
        textTransform: "uppercase", color: "var(--text-muted)",
      }}>
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid var(--border)", margin: "20px 0" }} />;
}

function Toggle({
  label, sub, checked, onChange,
}: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 0",
    }}>
      <div>
        <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-primary)" }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
            {sub}
          </div>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: "40px", height: "22px", borderRadius: "11px", border: "none",
          background: checked ? "var(--accent-green)" : "var(--border)",
          cursor: "pointer", position: "relative", flexShrink: 0,
          transition: "background 0.2s ease",
        }}
      >
        <div style={{
          position: "absolute", top: "3px",
          left: checked ? "21px" : "3px",
          width: "16px", height: "16px", borderRadius: "50%",
          background: "white", transition: "left 0.2s ease",
        }} />
      </button>
    </div>
  );
}

function SelectPill({
  options, value, onChange,
}: { options: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: "5px 12px", borderRadius: "20px", border: "1px solid",
            borderColor: value === opt.value ? "var(--accent-green)" : "var(--border)",
            background: value === opt.value ? "var(--accent-green-dim)" : "transparent",
            color: value === opt.value ? "var(--accent-green)" : "var(--text-muted)",
            fontSize: "12px", fontWeight: "500", cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function MultiSelect({
  label, options, selected, onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (val: string) => {
    onChange(selected.includes(val)
      ? selected.filter((s) => s !== val)
      : [...selected, val]);
  };

  return (
    <div style={{ position: "relative", marginBottom: "12px" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: "8px 12px", borderRadius: "8px",
          border: "1px solid var(--border)", background: "var(--bg-card)",
          color: selected.length > 0 ? "var(--text-primary)" : "var(--text-muted)",
          fontSize: "12px", cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "space-between",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <span>
          {selected.length === 0
            ? `All ${label}`
            : selected.length === 1
            ? selected[0]
            : `${selected.length} ${label} selected`}
        </span>
        <ChevronDown
          size={12}
          color="var(--text-muted)"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
        />
      </button>

      {open && options.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "8px", zIndex: 50, maxHeight: "180px", overflowY: "auto",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        }}>
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              style={{
                width: "100%", padding: "8px 12px", border: "none",
                background: selected.includes(opt) ? "var(--accent-green-dim)" : "transparent",
                color: selected.includes(opt) ? "var(--accent-green)" : "var(--text-primary)",
                fontSize: "12px", cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", gap: "8px",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <div style={{
                width: "14px", height: "14px", borderRadius: "4px",
                border: `1.5px solid ${selected.includes(opt) ? "var(--accent-green)" : "var(--border)"}`,
                background: selected.includes(opt) ? "var(--accent-green)" : "transparent",
                flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {selected.includes(opt) && (
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
              </div>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Live Preview
// A scaled-down visual mock of what the PDF pages will look like.
// We can't actually render react-pdf to canvas here without a worker,
// so we build a CSS replica that mirrors the real document layout.
function LivePreview({ stats, options, challenge }: { stats: ReportStats; options: ReportOptions; challenge?: ChallengeConfig | null }) {
  const pageStyle: React.CSSProperties = {
    background: "white", borderRadius: "4px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
    padding: "20px", marginBottom: "12px",
    width: "100%", color: "#1a1a2e",
  };
  const money = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(0)}`;
  const green = "#00b85e";
  const red = "#cc3355";

  // Same Tier A/B functions the Analytics Process tab and the PDF call.
  const proc = {
    duration: byDuration(stats.trades),
    direction: byDirection(stats.trades),
    cost: costProfile(stats.trades),
    recovery: recoveryFactor(stats.totalPnl, stats.maxDd),
    risk: rRiskProfile(stats.rMs),
    stop: stopQuality(stats.trades),
    reasons: byExitReason(stats.trades),
    magic: byMagic(stats.trades),
    legs: legStats(stats.trades),
    cash: externalCashFlow(stats.trades),
    durationCoverage: stats.trades.filter((t) => durationMinutes(t) !== null).length,
    execCoverage: stats.trades.filter((t) => t.exitReason || t.magic != null || t.legs != null || t.balanceAfter != null).length,
  };
  const propSim = challenge ? simulateChallenge(stats.trades, challenge, 500) : null;
  const prop = challenge && propSim
    ? { status: challengeStatus(stats.trades, challenge), sim: propSim, roi: challengeROI(challenge, propSim.passRate) }
    : null;

  const head = (title: string) => (
    <div style={{ marginTop: 10, marginBottom: 6 }}>
      <div style={{ fontSize: "7px", fontWeight: "800", color: "#555", textTransform: "uppercase", letterSpacing: "0.5px" }}>{title}</div>
      <div style={{ height: "1px", background: "#e0e0f0", marginTop: 3 }} />
    </div>
  );

  const grid = (items: { label: string; value: string; color?: string }[]) => (
    <div style={{ display: "flex", gap: "4px", marginBottom: "8px", flexWrap: "wrap" }}>
      {items.map((it) => (
        <div key={it.label} style={{
          flex: "1 1 28%", minWidth: 62, border: "1px solid #e0e0f0", borderRadius: "3px",
          padding: "4px", background: "#f8f8fd",
        }}>
          <div style={{ fontSize: "5px", color: "#aaa", marginBottom: "2px" }}>{it.label}</div>
          <div style={{ fontSize: "7px", fontWeight: "800", color: it.color || "#1a1a2e" }}>{it.value}</div>
        </div>
      ))}
    </div>
  );

  const bar = (pct: number, positive: boolean) => (
    <div style={{ height: "3px", background: "#f0f0f8", borderRadius: "2px", overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: positive ? green : red }} />
    </div>
  );

  const note = (text: string) => (
    <div style={{ fontSize: "5px", color: "#999", padding: "4px 0", fontStyle: "italic" }}>{text}</div>
  );

  const kv = (label: string, value: string, color?: string) => (
    <div key={label} style={{
      display: "flex", justifyContent: "space-between",
      padding: "3px 0", borderBottom: "1px solid #f0f0f8", fontSize: "6px",
    }}>
      <span style={{ color: "#555", fontWeight: "700" }}>{label}</span>
      <span style={{ color: color || "#1a1a2e", fontWeight: "800" }}>{value}</span>
    </div>
  );

  const hours = [...stats.hourData].sort((a, b) => b.totalPnl - a.totalPnl);
  const weekdays = stats.dowData.filter((d) => d.count > 0);
  const peakHour = Math.max(...stats.hourData.map((x) => Math.abs(x.totalPnl)), 1);
  const total = Math.max(stats.trades.length, 1);
  const anySelected = options.includeCover || options.includeStats || options.includeRisk ||
    options.includeRMultiples || options.includeExecution || options.includeProcess ||
    options.includePropFirm || options.includeTiming ||
    options.includeInstruments || options.includeDailyBreakdown || options.includeTradeHistory;

  return (
    <div style={pageStyle}>
      {options.includeCover && (
        <div style={{ borderBottom: "2px solid #00c464", paddingBottom: "12px", marginBottom: "12px" }}>
          <div style={{ fontSize: "11px", fontWeight: "800", color: "#0a0a1a", letterSpacing: "-0.3px" }}>quantedge</div>
          <div style={{ fontSize: "8px", color: "#888" }}>Trading Performance Report</div>
        </div>
      )}

      {options.includeStats && (
        <div>
          {head("Performance Summary")}
          {grid([
            { label: "Net P&L", value: money(stats.totalPnl), color: stats.totalPnl >= 0 ? green : red },
            { label: "Return", value: stats.returnPct === null ? "—" : `${stats.returnPct >= 0 ? "+" : ""}${stats.returnPct.toFixed(2)}%`, color: (stats.returnPct ?? 0) >= 0 ? green : red },
            { label: "Win Rate", value: `${stats.winRate}%` },
            { label: "Avg R:R", value: stats.avgRR === null ? "—" : `${stats.avgRR.toFixed(2)}R` },
            { label: "Expectancy", value: money(stats.expectancyDollars), color: stats.expectancyDollars >= 0 ? green : red },
            { label: "$/Hour", value: stats.hourlyRate === null ? "—" : `$${stats.hourlyRate.toFixed(2)}` },
          ])}
        </div>
      )}

      {options.includeRisk && (
        <div>
          {head("Risk & Drawdown")}
          {grid([
            { label: "Max DD", value: `${stats.maxDdPct.toFixed(1)}%`, color: red },
            { label: "Sharpe", value: stats.sharpe === 0 ? "—" : stats.sharpe.toFixed(2) },
            { label: "Sortino", value: stats.sortino === 0 ? "—" : stats.sortino.toFixed(2) },
            { label: "Calmar", value: stats.calmar === 0 ? "—" : stats.calmar.toFixed(2) },
          ])}
          {stats.riskCoverage > 0 ? (
            <>
              {kv("Avg planned risk", `$${stats.avgRisk.toFixed(2)}`)}
              {kv("Risk range", `$${stats.minRisk.toFixed(0)} – $${stats.maxRisk.toFixed(0)}`)}
              {kv("Risk consistency", `${stats.riskConsistency.toFixed(0)}%`)}
              {kv("Stop breaches", String(stats.stopBreaches))}
            </>
          ) : note("No stop loss recorded — re-run the exporter with a stop set.")}
        </div>
      )}

      {options.includeRMultiples && (
        <div>
          {head("R-Multiple Distribution")}
          {grid([
            { label: "Avg R", value: `${stats.avgR >= 0 ? "+" : ""}${stats.avgR.toFixed(2)}R`, color: stats.avgR >= 0 ? green : red },
            { label: "1R Unit", value: stats.rUnit > 0 ? `$${stats.rUnit.toFixed(0)}` : "—" },
            { label: "Expectancy", value: stats.expectancyR === null ? "—" : `${stats.expectancyR.toFixed(2)}R` },
          ])}
          {stats.rBuckets.length > 0 ? stats.rBuckets.map((b) => (
            <div key={b.bucket} style={{ padding: "2px 0", borderBottom: "1px solid #f4f4fc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "6px" }}>
                <span style={{ fontWeight: "800", color: "#1a1a2e" }}>{b.bucket}</span>
                <span style={{ color: "#555" }}>{b.count} · {Math.round((b.count / total) * 100)}%</span>
              </div>
              {bar((b.count / total) * 100, b.positive)}
            </div>
          )) : note("No R-multiples for this period.")}
        </div>
      )}

      {options.includeExecution && (
        <div>
          {head("Execution Quality")}
          {stats.execCoverage > 0 ? grid([
            { label: "Avg MAE", value: `$${stats.avgMae.toFixed(0)}`, color: red },
            { label: "Avg MFE", value: `$${stats.avgMfe.toFixed(0)}`, color: green },
            { label: "Entry Eff", value: `${stats.entryEff.toFixed(0)}%` },
            { label: "Exit Eff", value: `${stats.exitEff.toFixed(0)}%` },
          ]) : note("No MAE/MFE data — re-run the exporter with excursion scanning.")}
        </div>
      )}

      {options.includeInstruments && stats.instruments.length > 0 && (
        <div>
          {head("Instrument Breakdown")}
          <div style={{ display: "flex", gap: "3px", marginBottom: "3px" }}>
            {["Instrument", "Tr", "WR", "Net P&L", "Avg R"].map((h, i) => (
              <div key={h} style={{
                fontSize: "5px", fontWeight: "800", color: "#555",
                flex: i === 0 ? "0 0 58px" : i === 4 ? "0 0 32px" : "0 0 22px",
                textAlign: i === 0 ? "left" : "right",
              }}>{h}</div>
            ))}
          </div>
          {stats.instruments.slice(0, 6).map((r) => (
            <div key={r.symbol} style={{ display: "flex", gap: "3px", padding: "2px 0", borderBottom: "1px solid #f4f4fc" }}>
              <span style={{ fontSize: "6px", fontWeight: "800", color: "#1a1a2e", flex: "0 0 58px" }}>{r.symbol}</span>
              <span style={{ fontSize: "6px", color: "#555", flex: "0 0 22px", textAlign: "right" }}>{r.trades}</span>
              <span style={{ fontSize: "6px", color: "#555", flex: "0 0 22px", textAlign: "right" }}>{r.winRate}%</span>
              <span style={{ fontSize: "6px", fontWeight: "800", color: r.pnl >= 0 ? green : red, flex: "0 0 22px", textAlign: "right" }}>{money(r.pnl)}</span>
              <span style={{ fontSize: "6px", color: "#555", flex: "0 0 32px", textAlign: "right" }}>{r.avgR === null ? "—" : `${r.avgR.toFixed(2)}R`}</span>
            </div>
          ))}
        </div>
      )}

      {options.includeTiming && hours.length > 0 && (
        <div>
          {head("Timing")}
          {hours.slice(0, 6).map((h) => (
            <div key={h.hour} style={{ padding: "2px 0", borderBottom: "1px solid #f4f4fc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "6px" }}>
                <span style={{ fontWeight: "800", color: "#1a1a2e" }}>{h.label}</span>
                <span style={{ color: "#555" }}>{h.count} trade{h.count === 1 ? "" : "s"} · {h.winRate}% · </span>
                <span style={{ fontWeight: "800", color: h.totalPnl >= 0 ? green : red }}>{money(h.totalPnl)}</span>
              </div>
              {bar((Math.abs(h.totalPnl) / peakHour) * 100, h.totalPnl >= 0)}
            </div>
          ))}
          {weekdays.map((d) => kv(d.day, money(d.pnl), d.pnl >= 0 ? green : red))}
        </div>
      )}

      {options.includeDailyBreakdown && (
        <div>
          {head("Daily Breakdown")}
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between",
              padding: "3px 0", borderBottom: "1px solid #f0f0f8",
            }}>
              <div style={{ width: "40px", height: "5px", background: "#e0e0f0", borderRadius: "2px" }} />
              <div style={{ width: "30px", height: "5px", background: "#e0e0f0", borderRadius: "2px" }} />
              <div style={{ width: "20px", height: "5px", background: "#00b85e33", borderRadius: "2px" }} />
            </div>
          ))}
        </div>
      )}

      {options.includeTradeHistory && (
        <div>
          {head("Trade History")}
          <div style={{ background: "#f0f0f8", borderRadius: "2px", padding: "3px 4px", marginBottom: "3px", display: "flex", gap: "4px" }}>
            {["Date", "Symbol", "P&L"].map((h) => (
              <div key={h} style={{ flex: 1, fontSize: "5px", fontWeight: "700", color: "#888" }}>{h}</div>
            ))}
          </div>
          {[...Array(Math.min(stats.trades.length, 5))].map((_, i) => (
            <div key={i} style={{
              display: "flex", gap: "4px", padding: "2px 4px",
              background: i % 2 === 0 ? "transparent" : "#fafaff",
            }}>
              <div style={{ flex: 1, height: "4px", background: "#e0e0f0", borderRadius: "2px" }} />
              <div style={{ flex: 1, height: "4px", background: "#e0e0f0", borderRadius: "2px" }} />
              <div style={{ flex: 1, height: "4px", background: "#00b85e33", borderRadius: "2px" }} />
            </div>
          ))}
        </div>
      )}

      {options.includeProcess && (
        <div>
          {head("Process & Execution")}
          {grid([
            { label: "Recovery", value: proc.recovery.toFixed(2), color: proc.recovery >= 1 ? green : red },
            { label: "R St Dev", value: proc.risk.sigma > 0 ? proc.risk.sigma.toFixed(2) : "—" },
            { label: "Ruin", value: proc.risk.sigma > 0 ? `${(proc.risk.ruinApprox * 100).toFixed(1)}%` : "—" },
            { label: "Cost %", value: `${proc.cost.costPctOfGross.toFixed(1)}%`, color: proc.cost.costPctOfGross <= 10 ? green : red },
            { label: "Stop R", value: proc.stop.coverage > 0 ? proc.stop.avgRatio.toFixed(2) : "—" },
          ])}
          {proc.durationCoverage > 0 && proc.duration.map((b) => kv(`Hold: ${b.bucket}`, `${b.trades} · ${money(b.pnl)}`, b.pnl >= 0 ? green : red))}
          {proc.execCoverage > 0 && proc.reasons.slice(0, 4).map((b) => kv(b.bucket, `${b.trades} · ${money(b.pnl)}`, b.pnl >= 0 ? green : red))}
          {note("Hold-time buckets and exit reasons. Execution detail needs the recompiled exporter.")}
        </div>
      )}

      {options.includePropFirm && (
        <div>
          {head("Prop Firm Evaluation")}
          {challenge && prop ? (
            <>
              {grid([
                { label: "Pass", value: `${(prop.sim.passRate * 100).toFixed(1)}%`, color: prop.sim.passRate >= 0.5 ? green : red },
                { label: "Fail DD", value: `${(prop.sim.failDrawdown * 100).toFixed(1)}%`, color: red },
                { label: "ROI", value: `${prop.roi.roiPct >= 0 ? "+" : ""}${prop.roi.roiPct.toFixed(1)}%`, color: prop.roi.roiPct >= 0 ? green : red },
              ])}
              {kv("Profit target", `${challenge.targetPct}% · ${prop.status.profitProgress.toFixed(1)}% there`)}
              {kv("Drawdown", `${challenge.maxDdPct}% ${challenge.ddMode}`, red)}
              {kv("Daily limit", challenge.dailyLimitPct > 0 ? `${challenge.dailyLimitPct}%` : "none")}
            </>
          ) : (
            note("No prop-firm rules saved. Configure the Prop Firm tab in Analytics.")
          )}
        </div>
      )}

      {!anySelected && (
        <div style={{ textAlign: "center", padding: "32px", color: "#aaa", fontSize: "11px" }}>
          No sections selected
        </div>
      )}
    </div>
  );
}

// Main Export Page
export default function ExportPage() {
  const { trades, activeAccount } = useApp();

  const [options, setOptions] = useState<ReportOptions>({
    dateFrom: "", dateTo: "",
    tickers: [], tags: [],
    status: "all",
    includeCover: true,
    includeStats: true,
    includeDailyBreakdown: true,
    includeRisk: true,
    includeRMultiples: true,
    includeExecution: true,
    includeProcess: true,
    includePropFirm: true,
    includeTiming: true,
    includeInstruments: true,
    includeTradeHistory: true,
    includeJournal: false,
    journalLayout: "2",
  });

  // Prop-firm rules are stored per account by the Analytics Prop Firm tab.
  // Read them on the client only; localStorage is not available during SSR.
  const [challenge, setChallenge] = useState<ChallengeConfig | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`quantedge_prop_${activeAccount?.id ?? "default"}`);
      setChallenge(raw ? { ...DEFAULT_CHALLENGE, ...JSON.parse(raw) } : null);
    } catch {
      setChallenge(null);
    }
  }, [activeAccount?.id]);

  // Derive available filter options from actual trade data
  const availableTickers = useMemo(() =>
    [...new Set(trades.map((t) => t.underlying))].sort(), [trades]);

  const availableTags = useMemo(() =>
    [...new Set(trades.flatMap((t) => t.tags || []))].sort(), [trades]);

  // Apply filters to get the trades that will go in the report
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (options.dateFrom && t.date < options.dateFrom) return false;
      if (options.dateTo   && t.date > options.dateTo)   return false;
      if (options.tickers.length > 0 && !options.tickers.includes(t.underlying)) return false;
      if (options.tags.length > 0 && !options.tags.some((tag) => (t.tags || []).includes(tag))) return false;
      if (options.status !== "all" && t.status !== options.status) return false;
      return true;
    });
  }, [trades, options]);

  // Same maths the PDF and the Analytics tab use, so the preview matches the file.
  const reportStats = useMemo(
    () => buildReportStats(filteredTrades, activeAccount?.initialBalance ?? 0),
    [filteredTrades, activeAccount]
  );

  const set = <K extends keyof ReportOptions>(key: K, val: ReportOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: val }));

  const filename = `quantedge-report-${
    activeAccount?.name?.toLowerCase().replace(/\s+/g, "-") || "account"
  }-${new Date().toISOString().split("T")[0]}.pdf`;

  // Render
  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "26px", fontWeight: "700", color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
          Export
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
          Build a PDF performance report from your trade history
        </p>
      </div>

      <div style={{ display: "flex", gap: "24px", height: "calc(100vh - 168px)", overflow: "hidden" }}>

      {/* Left Panel: Report Builder */}
      <div style={{
        width: "340px", minWidth: "340px",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)", borderRadius: "12px",
        padding: "24px", overflowY: "auto",
        display: "flex", flexDirection: "column",
      }}>

        <h2 style={{
          fontSize: "16px", fontWeight: "700", color: "var(--text-primary)",
          marginBottom: "4px",
        }}>
          Report Builder
        </h2>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px" }}>
          {filteredTrades.length} trade{filteredTrades.length !== 1 ? "s" : ""} match your filters
        </p>

        {/* ── Filters ── */}
        <SectionHeading icon={Filter} label="Filters" />

        {/* Date range */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
              From
            </label>
            <input
              type="date"
              value={options.dateFrom}
              onChange={(e) => set("dateFrom", e.target.value)}
              style={{
                width: "100%", padding: "7px 10px", borderRadius: "8px",
                border: "1px solid var(--border)", background: "var(--bg-card)",
                color: "var(--text-primary)", fontSize: "12px",
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
              To
            </label>
            <input
              type="date"
              value={options.dateTo}
              onChange={(e) => set("dateTo", e.target.value)}
              style={{
                width: "100%", padding: "7px 10px", borderRadius: "8px",
                border: "1px solid var(--border)", background: "var(--bg-card)",
                color: "var(--text-primary)", fontSize: "12px",
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
          </div>
        </div>

        {/* Tickers */}
        <MultiSelect
          label="Tickers"
          options={availableTickers}
          selected={options.tickers}
          onChange={(v) => set("tickers", v)}
        />

        {/* Tags */}
        <MultiSelect
          label="Tags"
          options={availableTags}
          selected={options.tags}
          onChange={(v) => set("tags", v)}
        />

        {/* Status */}
        <div style={{ marginBottom: "12px" }}>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>
            Status
          </label>
          <SelectPill
            value={options.status}
            onChange={(v) => set("status", v as ReportOptions["status"])}
            options={[
              { label: "All", value: "all" },
              { label: "Wins", value: "win" },
              { label: "Losses", value: "loss" },
              { label: "Breakeven", value: "breakeven" },
            ]}
          />
        </div>

        <Divider />

        {/* ── Sections ── */}
        <SectionHeading icon={Layout} label="Report Sections" />

        <Toggle label="Cover Page"          checked={options.includeCover}          onChange={(v) => set("includeCover", v)} />
        <Toggle label="Performance Summary" checked={options.includeStats}          onChange={(v) => set("includeStats", v)} />
        <Toggle
          label="Risk &amp; Drawdown"
          sub="Drawdown, Sharpe/Sortino/Calmar, planned risk, risk consistency"
          checked={options.includeRisk} onChange={(v) => set("includeRisk", v)}
        />
        <Toggle
          label="R-Multiple Distribution"
          sub="Average R, 1R unit and the outcome histogram"
          checked={options.includeRMultiples} onChange={(v) => set("includeRMultiples", v)}
        />
        <Toggle
          label="Execution Quality"
          sub="MAE, MFE, entry and exit efficiency"
          checked={options.includeExecution} onChange={(v) => set("includeExecution", v)}
        />
        <Toggle
          label="Process Metrics"
          sub="Recovery factor, R dispersion, cost ratio, hold time and execution detail"
          checked={options.includeProcess}
          onChange={(v) => set("includeProcess", v)}
        />
        <Toggle
          label="Prop Firm Evaluation"
          sub="Challenge rules, standing and simulated pass probability"
          checked={options.includePropFirm}
          onChange={(v) => set("includePropFirm", v)}
        />
        <Toggle
          label="Instrument Breakdown"
          sub="Per-symbol trades, win rate, net P&L and average R"
          checked={options.includeInstruments} onChange={(v) => set("includeInstruments", v)}
        />
        <Toggle
          label="Timing"
          sub="Best and worst hours (24h) and weekdays"
          checked={options.includeTiming} onChange={(v) => set("includeTiming", v)}
        />
        <Toggle label="Daily Breakdown"      checked={options.includeDailyBreakdown} onChange={(v) => set("includeDailyBreakdown", v)} />
        <Toggle label="Trade History"        checked={options.includeTradeHistory}  onChange={(v) => set("includeTradeHistory", v)} />
        <Toggle
          label="Journal Entries"
          sub="Requires journal entries to be written"
          checked={options.includeJournal}
          onChange={(v) => set("includeJournal", v)}
        />

        {/* Journal layout options */}
        {options.includeJournal && (
          <div style={{ marginTop: "8px", marginBottom: "4px", paddingLeft: "12px", borderLeft: "2px solid var(--accent-green-dim)" }}>
            <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>
              Entries per page
            </label>
            <SelectPill
              value={options.journalLayout}
              onChange={(v) => set("journalLayout", v as ReportOptions["journalLayout"])}
              options={[
                { label: "1", value: "1" },
                { label: "2", value: "2" },
                { label: "4", value: "4" },
              ]}
            />
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        <Divider />

        {/* ── Export Button ── */}
        <ExportPDFInner
          trades={filteredTrades}
          account={activeAccount}
          challenge={challenge}
          options={options}
          filename={filename}
        />
      </div>

      {/* ── Right Panel: Live Preview ── */}
      <div style={{
        flex: 1, background: "var(--bg-secondary)",
        border: "1px solid var(--border)", borderRadius: "12px",
        padding: "24px", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
          <Eye size={14} color="var(--accent-green)" />
          <span style={{
            fontSize: "11px", fontWeight: "700", letterSpacing: "0.8px",
            textTransform: "uppercase", color: "var(--text-muted)",
          }}>
            Live Preview
          </span>
        </div>

        <LivePreview
          stats={reportStats}
          options={options}
          challenge={challenge}
        />

        <p style={{
          fontSize: "11px", color: "var(--text-muted)", textAlign: "center",
          marginTop: "16px",
        }}>
          Preview is approximate — the exported PDF will be full resolution
        </p>
      </div>
      </div>
    </div>
  );
}
