"use client";
import { useEffect, useMemo, useState } from "react";
import { Trade, Account } from "../lib/types";
import {
  ChallengeConfig, DEFAULT_CHALLENGE, FIRM_PRESETS, applyPreset,
  challengeStatus, simulateChallenge, challengePlan, challengeROI,
} from "../lib/analytics";
import { SectionCard, MetricCard } from "./AnalyticsCards";
import {
  Target, Shield, Activity, AlertTriangle, Clock, TrendingUp,
  Zap, Percent, Award,
} from "lucide-react";

const labelStyle: React.CSSProperties = {
  fontSize: "10px", fontWeight: "700", color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.5px",
};
const inputStyle: React.CSSProperties = {
  padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)",
  background: "var(--bg-secondary)", color: "var(--text-primary)",
  fontSize: "13px", colorScheme: "dark", fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%",
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
  const storageKey = `journedge_prop_${activeAccount?.id ?? "default"}`;
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

  const status = useMemo(() => challengeStatus(trades, config), [trades, config]);
  const sim    = useMemo(() => simulateChallenge(trades, config, 1500), [trades, config]);
  const plan   = useMemo(() => challengePlan(trades, config), [trades, config]);
  const roi    = useMemo(() => challengeROI(config, sim.passRate), [config, sim.passRate]);

  const money = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const pct1  = (v: number) => `${v.toFixed(1)}%`;

  const outcomes = [
    { label: "Pass",              value: sim.passRate,        color: "#00e57a" },
    { label: "Fail — daily",      value: sim.failDaily,       color: "#ff4d6a" },
    { label: "Fail — drawdown",   value: sim.failDrawdown,    color: "#ff4d6a" },
    { label: "Timeout",           value: sim.timeout,         color: "#8888aa" },
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

      <SectionCard title="Passing Probability" subtitle="Bootstrap simulation: your trades resampled into thousands of alternate paths, each walked through the rules above.">
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
