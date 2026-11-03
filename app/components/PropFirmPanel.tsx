"use client";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Trade, Account } from "../lib/types";
import {
  ChallengeConfig, DEFAULT_CHALLENGE, FIRM_PRESETS, applyPreset,
  challengeStatus, simulateChallenge, challengePlan, challengeROI,
  type ChallengeOutcome,
} from "../lib/analytics";
import { SectionCard } from "./AnalyticsCards";
import {
  Target, Shield, Activity, AlertTriangle, Clock, TrendingUp,
  Percent, Award, ChevronDown, CheckCircle2, XCircle, Info,
} from "lucide-react";
import {
  ComposedChart, BarChart, Area, Line, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, type TooltipContentProps,
} from "recharts";

const labelStyle: React.CSSProperties = {
  fontSize: "10px", fontWeight: "700", color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.5px",
};
const inputStyle: React.CSSProperties = {
  padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)",
  background: "var(--bg-secondary)", color: "var(--text-primary)",
  fontSize: "13px", colorScheme: "dark", fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%",
};
const axisStyle = { fontSize: 11, fill: "var(--text-secondary)" };
const chartTooltipStyle: React.CSSProperties = {
  background: "var(--tooltip-bg)", border: "1px solid var(--chart-grid)",
  borderRadius: "8px", color: "var(--text-primary)", fontSize: "12px",
};

const PATH_COLORS: Record<ChallengeOutcome, string> = {
  pass: "var(--profit)",
  daily: "var(--loss)",
  dd: "var(--loss)",
  timeout: "var(--text-secondary)",
  consistency: "var(--warning)",
};

const money0 = (v: number) =>
  `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

type BandTooltipRow = { p5: number; p50: number; p95: number };

function PathTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as BandTooltipRow | undefined;
  if (!row || typeof row.p5 !== "number") return null;
  const rows: [string, number][] = [
    ["95th pct", row.p95],
    ["Median", row.p50],
    ["5th pct", row.p5],
  ];
  return (
    <div style={chartTooltipStyle}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
        Day {label}
      </div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 24, fontSize: 11 }}>
          <span style={{ color: "var(--text-muted)" }}>{k}</span>
          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{money0(v)}</span>
        </div>
      ))}
    </div>
  );
}

// Four states cover every rule: satisfied, approaching the limit, past it, or
// outside this firm's rule set. The words matter more than the colour — a
// trader skimming the cards reads "Passing" before they read the bar.
type RuleTone = "ok" | "progress" | "watch" | "fail" | "off";

const TONE: Record<RuleTone, { color: string; bg: string; border: string; word: string; Icon: LucideIcon }> = {
  ok:       { color: "var(--profit)", bg: "rgba(0,229,122,0.07)",  border: "rgba(0,229,122,0.22)",  word: "Passing",  Icon: CheckCircle2 },
  progress: { color: "var(--accent-blue)", bg: "rgba(77,159,255,0.07)", border: "rgba(77,159,255,0.22)", word: "In progress", Icon: Info },
  watch:    { color: "var(--warning)", bg: "rgba(251,191,36,0.07)", border: "rgba(251,191,36,0.22)", word: "Watch",    Icon: AlertTriangle },
  fail:     { color: "var(--loss)", bg: "rgba(255,77,106,0.07)", border: "rgba(255,77,106,0.22)", word: "Breached", Icon: XCircle },
  off:      { color: "var(--text-secondary)", bg: "var(--bg-secondary)",   border: "var(--border)",          word: "No rule",  Icon: Info },
};

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <span style={labelStyle}>{label}</span>
      <input
        type="number" step={step} value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        style={inputStyle}
      />
    </label>
  );
}

function OptionalField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <span style={labelStyle}>{label}</span>
      <input
        type="number" min={0} value={value ?? ""} placeholder="none"
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        style={inputStyle}
      />
    </label>
  );
}

/** Progress ring. Sized in px rather than stretched, so it stays round whatever
 *  the card width is. */
function Ring({ pct, color, value, label }: { pct: number; color: string; value: string; label: string }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, pct / 100));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", flexShrink: 0 }}>
      <div style={{ position: "relative", width: "132px", height: "132px" }}>
        <svg width={132} height={132} viewBox="0 0 132 132" role="img" aria-label={`${label}: ${value}`}>
          <circle cx="66" cy="66" r={r} fill="none" stroke="var(--bg-secondary)" strokeWidth="10" />
          <circle
            cx="66" cy="66" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${circumference * filled} ${circumference}`}
            transform="rotate(-90 66 66)"
            style={{ transition: "stroke-dasharray 0.3s ease" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "26px", fontWeight: "800", color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        </div>
      </div>
      <span style={{ ...labelStyle, fontSize: "9.5px", textAlign: "center", lineHeight: 1.3 }}>{label}</span>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div>
      <div style={{ ...labelStyle, marginBottom: "5px" }}>{label}</div>
      <div style={{ fontSize: "19px", fontWeight: "800", color: color ?? "var(--text-primary)", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px", lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

type RuleCard = {
  key: string;
  label: string;
  icon: LucideIcon;
  value: string;
  pct: number;
  tone: RuleTone;
  detail: string;
};

function RuleTile({ rule }: { rule: RuleCard }) {
  const t = TONE[rule.tone];
  const capped = Math.max(0, Math.min(100, rule.pct));
  return (
    <div style={{
      background: "var(--bg-secondary)", border: "1px solid var(--border)",
      borderRadius: "12px", padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "9px" }}>
        <rule.icon size={13} color={t.color} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>
          {rule.label}
        </span>
      </div>

      {/* The chip sits beside the figure, not the label: at this card width a
          60px pill next to a 12px label forces every title onto two lines. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "9px" }}>
        <span style={{ fontSize: "21px", fontWeight: "800", color: t.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
          {rule.value}
        </span>
        <span style={{
          fontSize: "9px", fontWeight: "800", letterSpacing: "0.4px", textTransform: "uppercase",
          color: t.color, background: t.bg, border: `1px solid ${t.border}`,
          padding: "2px 6px", borderRadius: "20px", whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {t.word}
        </span>
      </div>

      {/* A rule this firm does not have gets no bar — an empty track reads as
          "0% used" when the truth is "not measured". */}
      {rule.tone !== "off" && (
        <div style={{ height: "7px", borderRadius: "4px", background: "var(--bg-card)", overflow: "hidden" }}>
          <div style={{
            width: `${capped}%`, height: "100%", borderRadius: "4px",
            background: t.color, transition: "width 0.2s ease",
          }} />
        </div>
      )}
      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "7px", lineHeight: 1.45 }}>
        {rule.detail}
      </div>
    </div>
  );
}

function LegendChip({ color, label, value }: { color: string; label: string; value?: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-muted)" }}>
      <span style={{ width: "9px", height: "9px", borderRadius: "3px", background: color, flexShrink: 0 }} />
      {label}
      {value && <span style={{ color: "var(--text-primary)", fontWeight: "700" }}>{value}</span>}
    </span>
  );
}

export default function PropFirmPanel({ trades, activeAccount }: { trades: Trade[]; activeAccount: Account | null }) {
  const storageKey = `quantedge_prop_${activeAccount?.id ?? "default"}`;
  const [loaded, setLoaded] = useState(false);
  const [config, setConfig] = useState<ChallengeConfig>(() => ({
    ...DEFAULT_CHALLENGE,
    accountSize: activeAccount?.initialBalance || DEFAULT_CHALLENGE.accountSize,
  }));

  useEffect(() => {
    let next: ChallengeConfig;
    try {
      const raw = localStorage.getItem(storageKey);
      next = raw
        ? { ...DEFAULT_CHALLENGE, ...JSON.parse(raw) }
        : { ...DEFAULT_CHALLENGE, accountSize: activeAccount?.initialBalance || DEFAULT_CHALLENGE.accountSize };
    } catch {
      next = { ...DEFAULT_CHALLENGE, accountSize: activeAccount?.initialBalance || DEFAULT_CHALLENGE.accountSize };
    }
    setConfig(next);
    setLoaded(true);
  }, [storageKey, activeAccount?.initialBalance]);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(storageKey, JSON.stringify(config)); } catch { /* storage full or blocked */ }
  }, [config, storageKey, loaded]);

  const set = <K extends keyof ChallengeConfig>(key: K, value: ChallengeConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  // The rule inputs stay open only when the trader asks for them; the summary
  // line underneath carries the same information at a glance.
  const [editing, setEditing] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  // Sixty faint lines behind a 320px band read as noise; the band and median
  // answer "where do attempts end up" on their own. The spaghetti is there for
  // the trader who wants to see the spread of individual outcomes.
  const [showPaths, setShowPaths] = useState(false);

  // 5000 paths is too much work to run on every keystroke, so the simulation
  // trails the rule inputs by a beat while the cheap single replay stays live.
  const [simConfig, setSimConfig] = useState<ChallengeConfig>(config);
  useEffect(() => {
    const id = setTimeout(() => setSimConfig(config), 250);
    return () => clearTimeout(id);
  }, [config]);

  const status = useMemo(() => challengeStatus(trades, config), [trades, config]);
  const sim    = useMemo(
    () => simulateChallenge(trades, simConfig, 5000, activeAccount?.initialBalance ?? 0),
    [trades, simConfig, activeAccount?.initialBalance],
  );
  const plan   = useMemo(() => challengePlan(trades, config), [trades, config]);
  const roi    = useMemo(() => challengeROI(config, sim.passRate), [config, sim.passRate]);

  const money = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const pct1  = (v: number) => `${v.toFixed(1)}%`;

  const verdict = useMemo(() => {
    if (trades.length === 0) {
      return {
        tone: "progress" as RuleTone,
        headline: "Import trades to score this challenge",
        line: "Every figure on this page is replayed from your own closed trades.",
      };
    }
    if (status.replayedBreach) {
      return {
        tone: "fail" as RuleTone,
        headline: "Replaying your trades, this path breaches a rule",
        line: `${status.replayedReason}. Everything below shows how far the path got first.`,
      };
    }
    if (status.targetHit && !status.minDaysMet) {
      return {
        tone: "watch" as RuleTone,
        headline: "Target reached, minimum days not yet met",
        line: `${status.tradingDays} of ${config.minDays} required trading days. Keep trading without giving profit back.`,
      };
    }
    if (status.targetHit && !status.consistencyOk) {
      return {
        tone: "watch" as RuleTone,
        headline: "Target reached, consistency rule would block it",
        line: `Your biggest day is ${pct1(status.consistencyShare)} of profit against a ${config.consistencyPct}% cap. It needs more days, not more size.`,
      };
    }
    if (status.targetHit) {
      return {
        tone: "ok" as RuleTone,
        headline: "This path passes every rule",
        line: "Target, minimum days and consistency are all satisfied by the trades in this account.",
      };
    }
    if (status.ddUsedPct >= 70 || status.dailyUsedPct >= 70) {
      return {
        tone: "watch" as RuleTone,
        headline: "Little room left before a limit",
        line: `${status.ddUsedPct >= 70 ? `${pct1(status.ddUsedPct)} of the drawdown allowance used` : `${pct1(status.dailyUsedPct)} of the daily limit used`} — the next losing run decides the evaluation.`,
      };
    }
    return {
      tone: "progress" as RuleTone,
      headline: "No rule breached yet, target not reached",
      line: "Replaying your own trades in date order: the account is still alive and still short of the target.",
    };
  }, [trades.length, status, config.minDays, config.consistencyPct]);

  const v = TONE[verdict.tone];

  // The five rules that can end an evaluation, in the order they usually bind.
  // Each figure comes from challengeStatus, so the tile and the simulation can
  // never quote different numbers for the same rule.
  const rules: RuleCard[] = useMemo(() => {
    const rows: RuleCard[] = [];
    const remaining = Math.max(0, status.targetAmount - status.profitAmount);
    rows.push({
      key: "target",
      label: "Profit target",
      icon: Target,
      value: pct1(Math.min(999, status.profitProgress)),
      pct: status.profitProgress,
      tone: status.targetHit ? "ok" : "progress",
      detail: status.targetHit
        ? `${money(status.profitAmount)} banked, target ${money(status.targetAmount)}`
        : `${money(status.profitAmount)} of ${money(status.targetAmount)} — ${money(remaining)} to go`,
    });

    rows.push({
      key: "dd",
      label: "Max drawdown",
      icon: Shield,
      value: pct1(status.ddUsedPct),
      pct: status.ddUsedPct,
      tone: status.ddAllowed <= 0 ? "off" : status.ddUsedPct >= 100 ? "fail" : status.ddUsedPct >= 70 ? "watch" : "ok",
      detail: status.ddAllowed <= 0
        ? "No drawdown rule set"
        : `${money(status.ddUsed)} of ${money(status.ddAllowed)} used · ${config.ddMode} floor ${money(status.ddReference - status.ddAllowed)}`,
    });

    rows.push({
      key: "daily",
      label: "Worst day vs limit",
      icon: AlertTriangle,
      value: config.dailyLimitPct === 0 ? "—" : pct1(status.dailyUsedPct),
      pct: status.dailyUsedPct,
      tone: config.dailyLimitPct === 0 ? "off" : status.dailyUsedPct >= 100 ? "fail" : status.dailyUsedPct >= 70 ? "watch" : "ok",
      detail: config.dailyLimitPct === 0
        ? "This firm has no daily loss rule"
        : `${money(status.worstDayPnl)} on ${status.worstDayDate || "—"} of ${money(status.dailyAllowed)} allowed`,
    });

    rows.push({
      key: "days",
      label: "Min trading days",
      icon: Clock,
      value: config.minDays > 0 ? `${status.tradingDays} / ${config.minDays}` : `${status.tradingDays}`,
      pct: config.minDays > 0 ? (status.tradingDays / config.minDays) * 100 : 100,
      tone: status.minDaysMet ? "ok" : "progress",
      detail: config.minDays === 0
        ? "No minimum-day rule set"
        : status.minDaysMet
          ? `Requirement met — ${status.tradingDays} days traded`
          : `${config.minDays - status.tradingDays} more day${config.minDays - status.tradingDays === 1 ? "" : "s"} with at least one trade`,
    });

    rows.push({
      key: "consistency",
      label: "Biggest day share",
      icon: Percent,
      value: config.consistencyPct == null ? "—" : pct1(status.consistencyShare),
      pct: config.consistencyPct ? (status.consistencyShare / config.consistencyPct) * 100 : 0,
      tone: config.consistencyPct == null ? "off" : status.consistencyOk ? "ok" : "fail",
      detail: config.consistencyPct == null
        ? "No consistency rule set"
        : `${money(status.biggestDayProfit)} best day against a ${pct1(config.consistencyPct)} cap on total profit`,
    });

    return rows;
  }, [status, config.ddMode, config.dailyLimitPct, config.minDays, config.consistencyPct]);

  const setupSummary = [
    money0(config.accountSize),
    `+${config.targetPct}% target`,
    `${config.maxDdPct}% max DD ${config.ddMode}`,
    config.dailyLimitPct > 0 ? `${config.dailyLimitPct}% daily` : null,
    config.minDays > 0 ? `${config.minDays} min days` : null,
    config.maxDays ? `${config.maxDays}-day limit` : null,
    config.consistencyPct != null ? `${config.consistencyPct}% consistency` : null,
  ].filter(Boolean).join(" · ");

  // One row per day. Every sampled path contributes a key so the fan can draw
  // them as individual lines, and terminated paths carry their last balance
  // forward to keep the chart flat rather than ending early.
  const chartData = useMemo(() => {
    if (sim.band.length === 0) return [];
    return sim.band.map((b) => {
      const row: Record<string, number> = {
        day: b.day, bandBase: b.bandBase, bandWidth: b.bandWidth,
        p5: b.p5, p50: b.p50, p95: b.p95,
      };
      if (showPaths) {
        sim.paths.forEach((p, i) => {
          row[`p${i}`] = p.series[Math.min(b.day, p.series.length - 1)];
        });
      }
      return row;
    });
  }, [sim, showPaths]);

  // The last ~60 trading days is enough to see the shape without turning the
  // bars into hairlines; the worst day is called out above the chart anyway.
  const dayBars = useMemo(
    () => status.days.slice(-60).map((d) => ({ label: d.date.slice(5), pnl: d.pnl })),
    [status.days],
  );

  const targetBalance = config.accountSize + (config.accountSize * config.targetPct) / 100;

  // The percentile band is a stacked area, so its implicit zero baseline pulls
  // recharts' auto domain down to $0 and squashes the whole fan into the top
  // third of the chart. Pin the axis to the band, the start balance and the
  // target instead, then round outward to a readable step.
  const fanDomain: [number, number] = useMemo(() => {
    if (chartData.length === 0) return [0, 1];
    // The axis is also clamped to the sampled paths themselves, because
    // allowDataOverflow keeps recharts from widening it back out to zero.
    const pathLows  = sim.paths.map((p) => Math.min(...p.series)).filter(Number.isFinite);
    const pathHighs = sim.paths.map((p) => Math.max(...p.series)).filter(Number.isFinite);
    const lo = Math.min(...chartData.map((r) => r.p5), ...pathLows);
    const hi = Math.max(...chartData.map((r) => r.p95), ...pathHighs, targetBalance);
    const span = Math.max(1, hi - lo);
    const pad = span * 0.08;
    const step = Math.pow(10, Math.floor(Math.log10(span)) - 1);
    return [Math.floor((lo - pad) / step) * step, Math.ceil((hi + pad) / step) * step];
  }, [chartData, targetBalance, sim.paths]);

  const passCount = sim.daysToPass.reduce((s, b) => s + b.count, 0);

  const outcomes = [
    { label: "Pass",               value: sim.passRate,        color: "var(--profit)" },
    { label: "Fail — daily",       value: sim.failDaily,       color: "var(--loss)" },
    { label: "Fail — drawdown",    value: sim.failDrawdown,    color: "var(--loss)" },
    { label: "Timeout",            value: sim.timeout,         color: "var(--text-secondary)" },
    { label: "Consistency breach", value: sim.consistencyFail, color: "var(--warning)" },
  ].filter((o) => o.value > 0.0005);

  const passColor = sim.runs === 0 ? "var(--text-secondary)" : sim.passRate >= 0.5 ? "var(--profit)" : sim.passRate >= 0.3 ? "var(--warning)" : "var(--loss)";

  return (
    <div>
      {/* ── Verdict ────────────────────────────────────────────────────── */}
      <div style={{
        background: v.bg, border: `1px solid ${v.border}`, borderRadius: "16px",
        padding: "20px 24px", marginBottom: "20px",
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "28px" }}>
          <Ring
            pct={sim.passRate * 100}
            color={passColor}
            value={sim.runs === 0 ? "—" : `${(sim.passRate * 100).toFixed(0)}%`}
            label="chance of passing"
          />

          <div style={{ flex: "1 1 260px", minWidth: "240px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "8px" }}>
              <v.Icon size={14} color={v.color} />
              <span style={{ fontSize: "10.5px", fontWeight: "800", letterSpacing: "0.7px", textTransform: "uppercase", color: v.color }}>
                {verdict.tone === "ok" ? "Passing" : verdict.tone === "fail" ? "Would fail" : verdict.tone === "watch" ? "At risk" : "On track"}
              </span>
            </div>
            <h3 style={{ fontSize: "19px", fontWeight: "700", color: "var(--text-primary)", lineHeight: 1.3, margin: "0 0 6px" }}>
              {verdict.headline}
            </h3>
            <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
              {verdict.line}
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(96px, 1fr))", gap: "20px", flex: "1 1 320px" }}>
            <Stat
              label="Target"
              value={pct1(status.profitProgress)}
              color={status.targetHit ? "var(--profit)" : "var(--text-primary)"}
              sub={`${money(status.profitAmount)} / ${money(status.targetAmount)}`}
            />
            <Stat
              label="Drawdown"
              value={pct1(status.ddUsedPct)}
              color={status.ddUsedPct >= 100 ? "var(--loss)" : status.ddUsedPct >= 70 ? "var(--warning)" : "var(--text-primary)"}
              sub={`${money(status.ddUsed)} / ${money(status.ddAllowed)}`}
            />
            <Stat
              label="Worst day"
              value={config.dailyLimitPct === 0 ? "—" : pct1(status.dailyUsedPct)}
              color={status.dailyUsedPct >= 100 ? "var(--loss)" : status.dailyUsedPct >= 70 ? "var(--warning)" : "var(--text-primary)"}
              sub={config.dailyLimitPct === 0 ? "No daily rule" : `${money(status.worstDayPnl)} of ${money(status.dailyAllowed)}`}
            />
          </div>
        </div>
      </div>

      {/* ── Setup ──────────────────────────────────────────────────────── */}
      <SectionCard
        title="The account you're tested against"
        subtitle="Presets are approximate starting points; firms change their rule sets. Everything on this page recalculates from these fields."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
          {FIRM_PRESETS.map((p) => {
            const active = p.name === config.firm;
            return (
              <button
                key={p.name}
                onClick={() => setConfig((c) => applyPreset(c, p.name))}
                aria-pressed={active}
                style={{
                  padding: "7px 13px", borderRadius: "20px", cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif", fontSize: "12px", fontWeight: "600",
                  background: active ? "rgba(0,229,122,0.12)" : "var(--bg-secondary)",
                  border: `1px solid ${active ? "rgba(0,229,122,0.45)" : "var(--border)"}`,
                  color: active ? "var(--accent-green)" : "var(--text-muted)",
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
              >
                {p.name}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", justifyContent: "space-between" }}>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums", lineHeight: 1.6 }}>
            {setupSummary}
          </span>
          <button
            onClick={() => setEditing((e) => !e)}
            aria-expanded={editing}
            style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              background: "none", border: "none", cursor: "pointer",
              color: "var(--accent-green)", fontSize: "12px", fontWeight: "700",
              fontFamily: "'DM Sans', sans-serif", padding: 0,
            }}
          >
            {editing ? "Done editing" : "Edit rules"}
            <ChevronDown size={13} style={{ transform: editing ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
          </button>
        </div>

        {editing && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "12px", marginTop: "18px", paddingTop: "18px", borderTop: "1px solid var(--border)",
          }}>
            <NumberField label="Account size" value={config.accountSize} onChange={(x) => set("accountSize", x)} step={1000} />
            <NumberField label="Profit target %" value={config.targetPct} onChange={(x) => set("targetPct", x)} step={0.5} />
            <NumberField label="Max total DD %" value={config.maxDdPct} onChange={(x) => set("maxDdPct", x)} step={0.5} />
            <NumberField label="Max daily loss %" value={config.dailyLimitPct} onChange={(x) => set("dailyLimitPct", x)} step={0.5} />

            <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <span style={labelStyle}>Drawdown type</span>
              <select value={config.ddMode} onChange={(e) => set("ddMode", e.target.value as "static" | "trailing")} style={inputStyle}>
                <option value="static">Static (from start)</option>
                <option value="trailing">Trailing (from peak)</option>
              </select>
            </label>
            <NumberField label="Min trading days" value={config.minDays} onChange={(x) => set("minDays", x)} />
            <OptionalField label="Time limit (days)" value={config.maxDays} onChange={(x) => set("maxDays", x)} />
            <OptionalField label="Consistency %" value={config.consistencyPct} onChange={(x) => set("consistencyPct", x)} />

            <NumberField label="Challenge fee" value={config.fee} onChange={(x) => set("fee", x)} step={10} />
            <NumberField label="Profit split %" value={config.splitPct} onChange={(x) => set("splitPct", x)} step={5} />
            <NumberField label="Months funded" value={config.monthsFunded} onChange={(x) => set("monthsFunded", x)} />
            <NumberField label="Expected monthly %" value={config.expectedMonthlyPct} onChange={(x) => set("expectedMonthlyPct", x)} step={0.5} />
          </div>
        )}
      </SectionCard>

      {/* ── Rule by rule ───────────────────────────────────────────────── */}
      <SectionCard
        title="Rule by rule"
        subtitle="Every rule that can end the evaluation, worst placed first. 100% means the limit is reached, not passed."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(188px, 1fr))", gap: "12px" }}>
          {rules.map((r) => <RuleTile key={r.key} rule={r} />)}
        </div>
      </SectionCard>

      {/* ── Day by day ─────────────────────────────────────────────────── */}
      <SectionCard
        title="Day by day"
        subtitle={
          config.dailyLimitPct === 0
            ? `Last ${dayBars.length} trading days behind the current balance.`
            : `Last ${dayBars.length} trading days. The dashed line is this firm's daily loss limit — a day that touches it ends the account.`
        }
      >
        {dayBars.length === 0 ? (
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Import trades to see the daily shape.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dayBars} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(x) => money0(Number(x))} width={62} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  formatter={(value) => [money(Number(value)), "Day P&L"]}
                />
                {config.dailyLimitPct > 0 && (
                  <ReferenceLine
                    y={-status.dailyAllowed}
                    stroke="var(--loss)"
                    strokeDasharray="6 4"
                    label={{ value: "Daily limit", position: "insideBottomRight", fill: "var(--loss)", fontSize: 10 }}
                  />
                )}
                <Bar dataKey="pnl" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                  {dayBars.map((d, i) => (
                    <Cell key={i} fill={d.pnl >= 0 ? "var(--profit)" : "var(--loss)"} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "10px" }}>
              <LegendChip color="var(--profit)" label="Winning day" />
              <LegendChip color="var(--loss)" label="Losing day" />
              {config.dailyLimitPct > 0 && <LegendChip color="var(--loss)" label="Daily limit" value={money(status.dailyAllowed)} />}
              <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--text-muted)" }}>
                {status.days.length} trading days · {pct1(status.dailyUsedPct)} of the daily limit used at worst
              </span>
            </div>
          </>
        )}
      </SectionCard>

      {/* ── Simulation ─────────────────────────────────────────────────── */}
      <SectionCard
        title="Chance of passing"
        subtitle={`Your trades resampled into ${sim.runs.toLocaleString()} alternate paths, each walked through the rules above.`}
      >
        {sim.scaled && (
          <div style={{ background: "rgba(77,159,255,0.08)", border: "1px solid rgba(77,159,255,0.25)", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px" }}>
            <p style={{ fontSize: "12px", color: "var(--accent-blue)", margin: 0, lineHeight: 1.6 }}>
              Trade P&amp;L is scaled ×{sim.scale.toFixed(2)} from your {money(activeAccount?.initialBalance ?? 0)} account onto the {money0(config.accountSize)} challenge.
            </p>
          </div>
        )}
        {sim.tooFew && (
          <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px" }}>
            <p style={{ fontSize: "12px", color: "var(--warning)", margin: 0, lineHeight: 1.6 }}>
              Only {sim.sampleTrades} trades across {sim.sampleDays} days. Below ~30 trades the estimate is unstable — treat it as a direction, not a number.
            </p>
          </div>
        )}

        {outcomes.length === 0 ? (
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>No simulatable outcomes yet.</p>
        ) : (
          <>
            <div style={{ display: "flex", height: "14px", borderRadius: "7px", overflow: "hidden", background: "var(--bg-secondary)", marginBottom: "12px" }}>
              {outcomes.map((o) => (
                <div key={o.label} title={`${o.label} ${pct1(o.value * 100)}`} style={{ width: `${o.value * 100}%`, background: o.color }} />
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 20px" }}>
              {outcomes.map((o) => (
                <LegendChip key={o.label} color={o.color} label={o.label} value={pct1(o.value * 100)} />
              ))}
            </div>
          </>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginTop: "18px" }}>
          {[
            { k: "Pass (any path)",      v: sim.runs === 0 ? "—" : pct1(sim.passRateRaw * 100) },
            { k: "Median days to pass",  v: sim.medianDaysToPass != null ? `${sim.medianDaysToPass}` : "—" },
            { k: "Consistency breaches", v: sim.runs === 0 ? "—" : pct1(sim.consistencyFail * 100) },
            { k: "Sample",               v: `${sim.sampleTrades} trades` },
          ].map((row) => (
            <div key={row.k} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "12px 14px" }}>
              <div style={{ ...labelStyle, marginBottom: "5px" }}>{row.k}</div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>{row.v}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "26px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "4px" }}>
            <h4 style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>Possible paths to funded</h4>
            <span style={{ fontSize: "11.5px", color: "var(--text-muted)", flex: 1 }}>
              percentile fan across {sim.runs.toLocaleString()} attempts
            </span>
            {sim.paths.length > 0 && (
              <button
                onClick={() => setShowPaths((v) => !v)}
                aria-pressed={showPaths}
                style={{
                  padding: "4px 9px", borderRadius: "6px", cursor: "pointer",
                  border: "1px solid var(--border)",
                  background: showPaths ? "rgba(77,159,255,0.14)" : "transparent",
                  color: showPaths ? "var(--accent-blue)" : "var(--text-muted)",
                  fontSize: "11px", fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {showPaths ? `Hide ${sim.paths.length} paths` : `Show ${sim.paths.length} paths`}
              </button>
            )}
          </div>

          {chartData.length === 0 ? (
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "10px" }}>Import trades to generate paths.</p>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", margin: "12px 0 10px" }}>
                {showPaths && (
                  <>
                    <LegendChip color={PATH_COLORS.pass} label="Pass" />
                    <LegendChip color={PATH_COLORS.daily} label="Fail" />
                    <LegendChip color={PATH_COLORS.timeout} label="Timeout" />
                    <LegendChip color={PATH_COLORS.consistency} label="Consistency" />
                  </>
                )}
                <LegendChip color="rgba(77,159,255,0.35)" label="5–95% band" />
                <LegendChip color="var(--accent-blue)" label="Median" />
              </div>

              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(d) => `D${d}`} />
                  <YAxis domain={fanDomain} allowDataOverflow tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(x) => money0(Number(x))} width={64} />
                  <Tooltip content={PathTooltip} />
                  <Area type="monotone" dataKey="bandBase" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
                  <Area type="monotone" dataKey="bandWidth" stackId="band" stroke="none" fill="var(--accent-blue)" fillOpacity={0.16} isAnimationActive={false} />
                  {showPaths && sim.paths.map((p, i) => (
                    <Line
                      key={i}
                      type="monotone"
                      dataKey={`p${i}`}
                      stroke={PATH_COLORS[p.outcome]}
                      strokeOpacity={0.18}
                      strokeWidth={1}
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  ))}
                  <Line type="monotone" dataKey="p50" stroke="var(--accent-blue)" strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false} />
                  <ReferenceLine
                    y={targetBalance}
                    stroke="var(--profit)"
                    strokeDasharray="6 4"
                    label={{ value: "Target", position: "insideTopRight", fill: "var(--profit)", fontSize: 10 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px", marginTop: "16px" }}>
                {sim.daysToPass.map((b) => (
                  <div key={b.label} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "10px 12px" }}>
                    <div style={{ ...labelStyle, marginBottom: "4px" }}>{b.label} days</div>
                    <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>{b.count.toLocaleString()}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                      {passCount > 0 ? `${((b.count / passCount) * 100).toFixed(0)}% of passes` : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.6, marginTop: "16px", marginBottom: 0 }}>
          The band shows where 90% of attempts sit day by day. Paths that fail flatten at their loss and paths that pass flatten at the target, so the fan separates rather than converging. Intraday drawdown is approximated from closed trades — a trailing or equity-based firm can breach on a position that was never closed at the low, which this model cannot see.
        </p>
      </SectionCard>

      {/* ── Pace, budget and fee ───────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
        <SectionCard title="Time & pace" subtitle="What the target still needs at your historical average.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "12px" }}>
            {[
              { icon: Clock, label: "Remaining days", value: plan.remainingDays != null ? `${plan.remainingDays}` : "No limit" },
              { icon: TrendingUp, label: "Required / day", value: plan.requiredDailyReturn != null ? money(plan.requiredDailyReturn) : "—" },
              { icon: Activity, label: "Trades to target", value: plan.tradesToTarget != null ? `${plan.tradesToTarget}` : "—" },
              { icon: Percent, label: "Average / trade", value: money(plan.avgPnl) },
            ].map((row) => (
              <div key={row.label} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <row.icon size={11} color="var(--text-muted)" />
                  <span style={{ ...labelStyle, fontSize: "9.5px" }}>{row.label}</span>
                </div>
                <div style={{ fontSize: "17px", fontWeight: "800", color: "var(--text-primary)" }}>{row.value}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.6, marginTop: "14px", marginBottom: 0 }}>
            At your average trade, this is the pace the target demands. A required-per-day above your average daily P&amp;L means the target is out of reach without changing something.
          </p>
        </SectionCard>

        <SectionCard title="Risk budget" subtitle="How much one trade can risk without an ordinary losing run ending the evaluation.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "12px" }}>
            <div style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "14px 16px" }}>
              <div style={{ ...labelStyle, marginBottom: "6px" }}>Max risk / trade</div>
              <div style={{ fontSize: "21px", fontWeight: "800", color: "var(--loss)", lineHeight: 1.1 }}>{money(plan.maxRiskPerTrade)}</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>{plan.maxRiskPerTradePct.toFixed(2)}% of account</div>
            </div>
            <div style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "14px 16px" }}>
              <div style={{ ...labelStyle, marginBottom: "6px" }}>Daily loss allowed</div>
              <div style={{ fontSize: "21px", fontWeight: "800", color: config.dailyLimitPct === 0 ? "var(--text-muted)" : "var(--warning)", lineHeight: 1.1 }}>
                {config.dailyLimitPct === 0 ? "—" : money(plan.dailyAllowed)}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                {config.dailyLimitPct === 0 ? "No daily rule set" : `${config.dailyLimitPct}% of account`}
              </div>
            </div>
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.6, marginTop: "14px", marginBottom: 0 }}>
            Budget assumes three losers inside a day when a daily rule exists, otherwise six inside the total drawdown. Stay under it and an ordinary bad day cannot end the account.
          </p>
        </SectionCard>
      </div>

      <SectionCard title="Return on the fee" subtitle="Expected value of one attempt, using the simulated pass rate and your funded-account assumptions.">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "28px" }}>
          <div style={{ flex: "0 0 auto", minWidth: "160px" }}>
            <div style={{ ...labelStyle, marginBottom: "6px" }}>ROI on fee</div>
            <div style={{
              fontSize: "40px", fontWeight: "800", lineHeight: 1,
              color: roi.roiPct >= 0 ? "var(--profit)" : "var(--loss)", fontVariantNumeric: "tabular-nums",
            }}>
              {pct1(roi.roiPct)}
            </div>
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "6px" }}>
              per attempt, after the {money(config.fee)} fee
            </div>
          </div>

          <div style={{ flex: "1 1 380px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: "12px" }}>
            {[
              { k: "Expected payout", v: money(roi.expectedPayout), c: roi.expectedPayout > 0 ? "var(--profit)" : "var(--text-primary)" },
              { k: "Net expected", v: money(roi.netExpected), c: roi.netExpected >= 0 ? "var(--profit)" : "var(--loss)" },
              { k: "Attempts to pass", v: roi.attemptsToPass != null ? roi.attemptsToPass.toFixed(1) : "—", c: "var(--text-primary)" },
              { k: "Cost to pass", v: roi.costToPass > 0 ? money(roi.costToPass) : "—", c: "var(--text-primary)" },
              { k: "Profit / month", v: money(roi.grossMonthlyProfit), c: "var(--text-primary)" },
              { k: "Payout / month", v: money(roi.traderMonthlyPayout), c: "var(--text-primary)" },
            ].map((row) => (
              <div key={row.k} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "12px 14px" }}>
                <div style={{ ...labelStyle, marginBottom: "5px" }}>{row.k}</div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: row.c }}>{row.v}</div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── Definitions, closed by default ─────────────────────────────── */}
      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={() => setNotesOpen((o) => !o)}
          aria-expanded={notesOpen}
          style={{
            display: "flex", alignItems: "center", gap: "8px", width: "100%",
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px",
            padding: "14px 18px", cursor: "pointer", textAlign: "left",
            fontFamily: "'DM Sans', sans-serif", color: "var(--text-secondary)", fontSize: "13px", fontWeight: "600",
          }}
        >
          <Award size={14} color="var(--accent-green)" />
          How these numbers are computed
          <ChevronDown
            size={14}
            color="var(--text-muted)"
            style={{ marginLeft: "auto", transform: notesOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}
          />
        </button>

        {notesOpen && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "12px", marginTop: "12px",
          }}>
            {[
              { name: "Pass rate", formula: "bootstrap Monte Carlo", what: "Your trades resampled into thousands of paths and walked through every rule. A closed-form win-rate × R:R figure ignores the daily and drawdown rules that end most evaluations." },
              { name: "Static vs trailing DD", formula: "floor = start | peak", what: "Static draws down from the starting balance. Trailing draws down from the highest balance reached, so a winner before the breach lowers your floor." },
              { name: "Daily loss limit", formula: "day start − balance", what: "Measured from the balance at the start of each day, resetting every day. It binds fast on a single oversized loser." },
              { name: "Consistency rule", formula: "biggest day / total profit", what: "Caps how much of the profit one day may contribute. Breaching it does not fail you — it stops the profit counting, so it needs more days, not more size." },
              { name: "Expected payout", formula: "pass rate × split × months", what: "Probability-weighted trader payout. Compare it against the fee to see whether the evaluation is worth taking at all." },
              { name: "ROI on fee", formula: "(expected payout − fee) / fee", what: "Positive means one attempt is, on average, profitable. The attempts-to-pass figure is the honest cost of finally getting funded." },
            ].map(({ name, formula, what }) => (
              <div key={name} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 16px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>{name}</div>
                <div style={{ fontSize: "10px", fontFamily: "monospace", color: "var(--accent-blue)", background: "rgba(77,159,255,0.08)", padding: "4px 8px", borderRadius: "4px", marginBottom: "8px", overflowX: "auto", whiteSpace: "nowrap" }}>{formula}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5 }}>{what}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
