"use client";
import { useEffect, useMemo, useState } from "react";
import { Trade, Account } from "../lib/types";
import {
  ChallengeConfig, DEFAULT_CHALLENGE, FIRM_PRESETS, applyPreset,
  challengeStatus, simulateChallenge, challengePlan, challengeROI,
  type ChallengeOutcome,
} from "../lib/analytics";
import { SectionCard, MetricCard } from "./AnalyticsCards";
import {
  Target, Shield, Activity, AlertTriangle, Clock, TrendingUp,
  Zap, Percent, Award,
} from "lucide-react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, type TooltipContentProps,
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
const axisStyle = { fontSize: 11, fill: "#a8a8c8" };
const chartTooltipStyle: React.CSSProperties = {
  background: "#16161f", border: "1px solid #2a2a3a",
  borderRadius: "8px", color: "#f0f0ff", fontSize: "12px",
};

const PATH_COLORS: Record<ChallengeOutcome, string> = {
  pass: "#00e57a",
  daily: "#ff4d6a",
  dd: "#ff4d6a",
  timeout: "#a8a8c8",
  consistency: "#fbbf24",
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

function Bar({ label, pct, detail, inverse }: { label: string; pct: number; detail: string; inverse?: boolean }) {
  const capped = Math.max(0, Math.min(100, pct));
  const tone = inverse
    ? capped >= 90 ? "#ff4d6a" : capped >= 70 ? "#fbbf24" : "#00e57a"
    : capped >= 100 ? "#00e57a" : "#4d9fff";
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
        <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>{label}</span>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{detail}</span>
      </div>
      <div style={{ height: "8px", borderRadius: "6px", background: "var(--bg-secondary)", overflow: "hidden" }}>
        <div style={{ width: `${capped}%`, height: "100%", borderRadius: "6px", background: tone, transition: "width 0.2s ease" }} />
      </div>
    </div>
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
      sim.paths.forEach((p, i) => {
        row[`p${i}`] = p.series[Math.min(b.day, p.series.length - 1)];
      });
      return row;
    });
  }, [sim]);

  const targetBalance = config.accountSize + (config.accountSize * config.targetPct) / 100;
  const passCount = sim.daysToPass.reduce((s, b) => s + b.count, 0);

  const outcomes = [
    { label: "Pass",              value: sim.passRate,        color: "#00e57a" },
    { label: "Fail — daily",      value: sim.failDaily,       color: "#ff4d6a" },
    { label: "Fail — drawdown",   value: sim.failDrawdown,    color: "#ff4d6a" },
    { label: "Timeout",           value: sim.timeout,         color: "#a8a8c8" },
    { label: "Consistency breach", value: sim.consistencyFail, color: "#fbbf24" },
  ].filter((o) => o.value > 0.0005);

  return (
    <div>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 16px", marginBottom: "20px" }}>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
          <strong style={{ color: "var(--text-primary)" }}>Evaluation rules.</strong> Presets are approximate starting points and firms change their rule sets —
          edit every field to match the exact account you are trading. Passing probability is a bootstrap simulation over your own imported trades, not a promise.
        </p>
      </div>

      <SectionCard title="Challenge Rules" subtitle="The account you are evaluating against. Everything below recalculates from these fields.">
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "5px", maxWidth: "280px" }}>
            <span style={labelStyle}>Firm preset</span>
            <select
              value={config.firm}
              onChange={(e) => setConfig((c) => applyPreset(c, e.target.value))}
              style={inputStyle}
            >
              {FIRM_PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
          <NumberField label="Account size" value={config.accountSize} onChange={(v) => set("accountSize", v)} step={1000} />
          <NumberField label="Profit target %" value={config.targetPct} onChange={(v) => set("targetPct", v)} step={0.5} />
          <NumberField label="Max daily loss %" value={config.dailyLimitPct} onChange={(v) => set("dailyLimitPct", v)} step={0.5} />
          <NumberField label="Max total DD %" value={config.maxDdPct} onChange={(v) => set("maxDdPct", v)} step={0.5} />

          <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <span style={labelStyle}>Drawdown type</span>
            <select value={config.ddMode} onChange={(e) => set("ddMode", e.target.value as "static" | "trailing")} style={inputStyle}>
              <option value="static">Static (from start)</option>
              <option value="trailing">Trailing (from peak)</option>
            </select>
          </label>
          <NumberField label="Min trading days" value={config.minDays} onChange={(v) => set("minDays", v)} />
          <OptionalField label="Time limit (days)" value={config.maxDays} onChange={(v) => set("maxDays", v)} />
          <OptionalField label="Consistency %" value={config.consistencyPct} onChange={(v) => set("consistencyPct", v)} />

          <NumberField label="Challenge fee" value={config.fee} onChange={(v) => set("fee", v)} step={10} />
          <NumberField label="Profit split %" value={config.splitPct} onChange={(v) => set("splitPct", v)} step={5} />
          <NumberField label="Months funded" value={config.monthsFunded} onChange={(v) => set("monthsFunded", v)} />
          <NumberField label="Expected monthly %" value={config.expectedMonthlyPct} onChange={(v) => set("expectedMonthlyPct", v)} step={0.5} />
        </div>
      </SectionCard>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
        <MetricCard
          label="Pass Rate"
          value={sim.runs === 0 ? "—" : pct1(sim.passRate * 100)}
          positive={sim.passRate >= 0.5}
          neutral={sim.runs === 0}
          icon={Award}
          sub={sim.runs === 0 ? "Import trades to simulate" : `${sim.runs.toLocaleString()} simulated attempts`}
        />
        <MetricCard
          label="Target Progress"
          value={pct1(status.profitProgress)}
          positive={status.profitProgress >= 100}
          icon={Target}
          sub={`${money(status.profitAmount)} of ${money(status.targetAmount)}`}
        />
        <MetricCard
          label="Drawdown Used"
          value={pct1(status.ddUsedPct)}
          positive={false}
          neutral={status.ddAllowed === 0}
          icon={Shield}
          sub={`${money(status.ddUsed)} of ${money(status.ddAllowed)} ${config.ddMode}`}
        />
        <MetricCard
          label="Worst Day / Limit"
          value={config.dailyLimitPct === 0 ? "—" : pct1(status.dailyUsedPct)}
          positive={false}
          neutral={config.dailyLimitPct === 0}
          icon={AlertTriangle}
          sub={config.dailyLimitPct === 0 ? "No daily rule set" : `${money(status.worstDayPnl)} on ${status.worstDayDate || "—"}`}
        />
      </div>

      <SectionCard title="Challenge Standing" subtitle="Where the imported trades sit against each rule, right now.">
        <Bar label="Profit target" pct={status.profitProgress} detail={`${money(status.profitAmount)} / ${money(status.targetAmount)}`} />
        <Bar label="Total drawdown" pct={status.ddUsedPct} detail={`${money(status.ddUsed)} / ${money(status.ddAllowed)}`} inverse />
        {config.dailyLimitPct > 0 && (
          <Bar label="Worst day vs daily limit" pct={status.dailyUsedPct} detail={`${money(status.worstDayPnl)} / ${money(status.dailyAllowed)}`} inverse />
        )}
        <Bar
          label="Minimum trading days"
          pct={config.minDays > 0 ? (status.tradingDays / config.minDays) * 100 : 100}
          detail={config.minDays > 0 ? `${status.tradingDays} / ${config.minDays} days` : `${status.tradingDays} days`}
        />
        {config.consistencyPct != null && (
          <Bar
            label="Consistency (biggest day share)"
            pct={config.consistencyPct > 0 ? (status.consistencyShare / config.consistencyPct) * 100 : 0}
            detail={`${pct1(status.consistencyShare)} / ${pct1(config.consistencyPct)} cap`}
            inverse
          />
        )}

        <div style={{ marginTop: "8px", background: "var(--bg-secondary)", borderRadius: "10px", padding: "14px 16px" }}>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
            {status.replayedBreach
              ? `Replaying your own trades: ${status.replayedReason}.`
              : status.replayedPass
                ? "Replaying your own trades: this path would have reached the target without breaching a rule."
                : status.targetHit
                  ? "The target is reached. Check the minimum-days and consistency rules before calling it passed."
                  : "Replaying your own trades: no rule breached yet, target not reached yet."}
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Passing Probability" subtitle="Bootstrap simulation: your trades resampled into 5,000 alternate paths, each walked through the rules above.">
        {sim.scaled && (
          <div style={{ background: "rgba(77,159,255,0.08)", border: "1px solid rgba(77,159,255,0.25)", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px" }}>
            <p style={{ fontSize: "12px", color: "#4d9fff", margin: 0, lineHeight: 1.6 }}>
              Trade P&amp;L is scaled ×{sim.scale.toFixed(2)} from your {money(activeAccount?.initialBalance ?? 0)} account onto the {money(config.accountSize)} challenge.
            </p>
          </div>
        )}
        {sim.tooFew && (
          <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px" }}>
            <p style={{ fontSize: "12px", color: "#fbbf24", margin: 0, lineHeight: 1.6 }}>
              Only {sim.sampleTrades} trades across {sim.sampleDays} days. Below ~30 trades the estimate is unstable — treat it as a direction, not a number.
            </p>
          </div>
        )}
        {outcomes.length === 0 ? (
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>No simulatable outcomes yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {outcomes.map((o) => (
              <div key={o.label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ width: "160px", fontSize: "12px", color: "var(--text-secondary)" }}>{o.label}</span>
                <div style={{ flex: 1, height: "10px", borderRadius: "6px", background: "var(--bg-secondary)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, o.value * 100)}%`, height: "100%", background: o.color, borderRadius: "6px" }} />
                </div>
                <span style={{ width: "60px", textAlign: "right", fontSize: "12px", fontWeight: "700", color: o.color }}>
                  {pct1(o.value * 100)}
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: "16px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
          {[
            { k: "Pass (any path)",     v: pct1(sim.passRateRaw * 100), c: "var(--text-primary)" },
            { k: "Median days to pass", v: sim.medianDaysToPass != null ? `${sim.medianDaysToPass} days` : "—", c: "var(--text-primary)" },
            { k: "Consistency breaches", v: pct1(sim.consistencyFail * 100), c: "var(--text-primary)" },
          ].map((row) => (
            <div key={row.k} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "12px 14px" }}>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>{row.k}</div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: row.c }}>{row.v}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.6, marginTop: "14px", marginBottom: 0 }}>
          Intraday drawdown is approximated from closed trades. A trailing or equity-based firm can breach on a position that was never closed at the low, which this model cannot see.
        </p>
      </SectionCard>

      <SectionCard
        title="Possible Paths to Funded"
        subtitle={`${sim.runs.toLocaleString()} simulated attempts, drawn as a percentile fan with a sample of ${sim.paths.length} individual paths. The dashed line is the profit target.`}
      >
        {chartData.length === 0 ? (
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Import trades to generate paths.</p>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginBottom: "10px" }}>
              {[
                { label: "Pass", color: PATH_COLORS.pass },
                { label: "Fail", color: PATH_COLORS.daily },
                { label: "Timeout", color: PATH_COLORS.timeout },
                { label: "Consistency", color: PATH_COLORS.consistency },
                { label: "5–95% band", color: "rgba(77,159,255,0.35)" },
                { label: "Median", color: "#4d9fff" },
              ].map((l) => (
                <span key={l.label} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-muted)" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(d) => `D${d}`} />
                <YAxis domain={["auto", "auto"]} tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => money0(Number(v))} width={64} />
                <Tooltip content={PathTooltip} />
                <Area type="monotone" dataKey="bandBase" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
                <Area type="monotone" dataKey="bandWidth" stackId="band" stroke="none" fill="#4d9fff" fillOpacity={0.16} isAnimationActive={false} />
                {sim.paths.map((p, i) => (
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
                <Line type="monotone" dataKey="p50" stroke="#4d9fff" strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false} />
                <ReferenceLine
                  y={targetBalance}
                  stroke="#00e57a"
                  strokeDasharray="6 4"
                  label={{ value: "Target", position: "insideTopRight", fill: "#00e57a", fontSize: 10 }}
                />
              </ComposedChart>
            </ResponsiveContainer>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px", marginTop: "16px" }}>
              {sim.daysToPass.map((b) => (
                <div key={b.label} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "10px 12px" }}>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>{b.label} days</div>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>{b.count.toLocaleString()}</div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                    {passCount > 0 ? `${((b.count / passCount) * 100).toFixed(0)}% of passes` : "—"}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.6, marginTop: "12px", marginBottom: 0 }}>
              The band shows where 90% of attempts sit day by day. Paths that fail flatten at their loss; paths that pass flatten at the target, so the fan separates rather than converging.
            </p>
          </>
        )}
      </SectionCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <SectionCard title="Time & Pace" subtitle="What the target still requires at your historical average.">
          {[
            { icon: Clock, label: "Remaining days", value: plan.remainingDays != null ? `${plan.remainingDays} days` : "No time limit" },
            { icon: TrendingUp, label: "Required per day", value: plan.requiredDailyReturn != null ? money(plan.requiredDailyReturn) : "—" },
            { icon: Activity, label: "Trades to target", value: plan.tradesToTarget != null ? `${plan.tradesToTarget} at your avg` : "—" },
            { icon: Percent, label: "Average per trade", value: money(plan.avgPnl) },
          ].map((row) => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: "8px", marginBottom: "8px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
                <row.icon size={13} /> {row.label}
              </span>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>{row.value}</span>
            </div>
          ))}
        </SectionCard>

        <SectionCard title="Risk Budget" subtitle="How much one trade can risk without a normal losing run ending the evaluation.">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <MetricCard label="Max Risk / Trade" value={money(plan.maxRiskPerTrade)} positive={false} icon={Shield} sub={`${plan.maxRiskPerTradePct.toFixed(2)}% of account`} />
            <MetricCard label="Daily Loss Allowed" value={config.dailyLimitPct === 0 ? "—" : money(plan.dailyAllowed)} neutral icon={AlertTriangle} sub={config.dailyLimitPct === 0 ? "No daily rule set" : `${config.dailyLimitPct}% of account`} />
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.6, marginTop: "14px", marginBottom: 0 }}>
            Budget assumes three losers inside a day when a daily rule exists, otherwise six inside the total drawdown. Stay under it and an ordinary bad day cannot end the account.
          </p>
        </SectionCard>
      </div>

      <SectionCard title="Return on the Fee" subtitle="Expected value of one attempt, using the simulated pass rate and your funded-account assumptions.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
          <MetricCard label="Expected Payout" value={money(roi.expectedPayout)} positive={roi.expectedPayout > 0} icon={TrendingUp} sub={`${config.splitPct}% split, ${config.monthsFunded} months`} />
          <MetricCard label="Net Expected" value={money(roi.netExpected)} positive={roi.netExpected >= 0} icon={Activity} sub="Payout minus one fee" />
          <MetricCard label="ROI on Fee" value={pct1(roi.roiPct)} positive={roi.roiPct >= 0} icon={Percent} sub="Per attempt" />
          <MetricCard label="Attempts to Pass" value={roi.attemptsToPass != null ? roi.attemptsToPass.toFixed(1) : "—"} neutral icon={Zap} sub={roi.costToPass > 0 ? `${money(roi.costToPass)} expected cost` : "Set a pass rate"} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: "8px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Account profit / month</span>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>{money(roi.grossMonthlyProfit)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: "8px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Your payout / month</span>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>{money(roi.traderMonthlyPayout)}</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Reading These Numbers">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {[
            { name: "Pass Rate", formula: "bootstrap Monte Carlo", what: "Your trades resampled into thousands of paths and walked through every rule. A closed-form win-rate x R:R figure ignores the daily and drawdown rules that end most evaluations." },
            { name: "Static vs Trailing DD", formula: "floor = start | peak", what: "Static draws down from the starting balance. Trailing draws down from the highest balance reached, so a winner before the breach lowers your floor." },
            { name: "Daily Loss Limit", formula: "day start - balance", what: "Measured from the balance at the start of each day, resetting every day. It binds fast on a single oversized loser." },
            { name: "Consistency Rule", formula: "biggest day / total profit", what: "Caps how much of the profit one day may contribute. Breaching it does not fail you — it stops the profit counting, so it needs more days, not more size." },
            { name: "Expected Payout", formula: "pass rate x split x months", what: "Probability-weighted trader payout. Compare it against the fee to see whether the evaluation is worth taking at all." },
            { name: "ROI on Fee", formula: "(expected payout - fee) / fee", what: "Positive means one attempt is, on average, profitable. The attempts-to-pass figure is the honest cost of finally getting funded." },
          ].map(({ name, formula, what }) => (
            <div key={name} style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "14px 16px" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>{name}</div>
              <div style={{ fontSize: "10px", fontFamily: "monospace", color: "#4d9fff", background: "rgba(77,159,255,0.08)", padding: "4px 8px", borderRadius: "4px", marginBottom: "8px", overflowX: "auto", whiteSpace: "nowrap" }}>{formula}</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5 }}>{what}</div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
