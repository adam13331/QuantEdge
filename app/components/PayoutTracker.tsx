"use client";
import { t as tr } from "../lib/i18n";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip,
  XAxis, YAxis, type TooltipContentProps,
} from "recharts";
import { ChevronDown, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import {
  costComparison, payoutCurve, payoutSummary,
  type PayoutCurvePoint, type PayoutKind, type PropLedgerEntry,
} from "../lib/analytics";
import { SectionCard } from "./AnalyticsCards";

const labelStyle: React.CSSProperties = {
  fontSize: "10px", fontWeight: 700, color: "var(--text-muted)",
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
const linkButtonStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "5px",
  background: "none", border: "none", cursor: "pointer",
  color: "var(--accent-green)", fontSize: "12px", fontWeight: 700,
  fontFamily: "'DM Sans', sans-serif", padding: 0,
};
const primaryButtonStyle: React.CSSProperties = {
  padding: "8px 14px", borderRadius: "8px", cursor: "pointer",
  fontFamily: "'DM Sans', sans-serif", fontSize: "12px", fontWeight: 700,
  background: "rgba(0,229,122,0.12)", border: "1px solid rgba(0,229,122,0.45)",
  color: "var(--accent-green)",
};
const secondaryButtonStyle: React.CSSProperties = {
  padding: "8px 14px", borderRadius: "8px", cursor: "pointer",
  fontFamily: "'DM Sans', sans-serif", fontSize: "12px", fontWeight: 600,
  background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)",
};
const FEE_COLOR = "var(--loss)";
const PAYOUT_COLOR = "var(--profit)";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const arrowButtonStyle: React.CSSProperties = {
  background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px",
  padding: "6px", cursor: "pointer", color: "var(--text-primary)",
  display: "flex", alignItems: "center",
};

const money = (v: number) =>
  `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const money0 = (v: number) =>
  `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const pct1 = (v: number) => `${v.toFixed(0)}%`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Local calendar date, not UTC: a trade journal's "today" is the trader's day.
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "12px 14px" }}>
      <div style={{ ...labelStyle, marginBottom: "5px" }}>{label}</div>
      <div style={{ fontSize: "19px", fontWeight: 800, color: color ?? "var(--text-primary)", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px", lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

function LegendChip({ color, label, value }: { color: string; label: string; value?: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-muted)" }}>
      <span style={{ width: "9px", height: "9px", borderRadius: "3px", background: color, flexShrink: 0 }} />
      {label}
      {value && <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{value}</span>}
    </span>
  );
}

function KindChip({ kind }: { kind: PayoutKind }) {
  const fee = kind === "fee";
  return (
    <span style={{
      fontSize: "9px", fontWeight: 800, letterSpacing: "0.4px", textTransform: "uppercase",
      color: fee ? FEE_COLOR : PAYOUT_COLOR,
      background: fee ? "rgba(255,77,106,0.07)" : "rgba(0,229,122,0.07)",
      border: `1px solid ${fee ? "rgba(255,77,106,0.22)" : "rgba(0,229,122,0.22)"}`,
      padding: "2px 6px", borderRadius: "20px", whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {tr(fee ? "Fee" : "Payout")}
    </span>
  );
}

function LedgerTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as PayoutCurvePoint | undefined;
  if (!row || typeof row.net !== "number") return null;
  const rows: [string, number, string][] = [
    ["Fees paid", row.fees, FEE_COLOR],
    ["Payouts received", row.payouts, PAYOUT_COLOR],
    ["Net", row.net, row.net >= 0 ? PAYOUT_COLOR : FEE_COLOR],
  ];
  return (
    <div style={chartTooltipStyle}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
        {label}
      </div>
      {rows.map(([k, v, c]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 24, fontSize: 11 }}>
          <span style={{ color: "var(--text-muted)" }}>{k}</span>
          <span style={{ color: c, fontWeight: 600 }}>{money(v)}</span>
        </div>
      ))}
    </div>
  );
}

// One labelled figure inside the model-vs-ledger strip.
function Figure({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: "112px" }}>
      <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: "14px", fontWeight: 700, color: color ?? "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

export default function PayoutTracker({ accountId, plannedFee, estimatedCostToPass, firm }: {
  accountId: string | null;
  plannedFee: number;
  // challengeROI's expected fee spend before funding; null when the pass rate
  // is unknown, which is when there is nothing to compare the ledger against.
  estimatedCostToPass: number | null;
  // The firm the account is configured against now. New entries default to it.
  firm: string;
}) {
  const [entries, setEntries] = useState<PropLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // `firm: null` means "follow the account's preset" — the input shows it live
  // until the trader types, so switching preset cannot leave a stale name on
  // an entry that has not been saved yet.
  const [draft, setDraft] = useState<{ kind: PayoutKind; date: string; amount: string; label: string; firm: string | null }>({
    kind: "fee", date: today(), amount: "", label: tr(""), firm: null,
  });
  // Calendar-style stepping: the same ledger read over a month, a year, or all
  // time. "all" is the default because recovery and the model comparison only
  // mean anything against the lifetime totals.
  const [scope, setScope] = useState<"month" | "year" | "all">("all");
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const load = useCallback(async () => {
    setAdding(false);
    if (!accountId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/prop-ledger?accountId=${encodeURIComponent(accountId)}`);
      if (!res.ok) throw new Error("request failed");
      const list = (await res.json()) as PropLedgerEntry[];
      setEntries(list);
      setError(null);
      // A ledger with nothing in it should invite the first entry rather than
      // hide its only action behind a toggle.
      if (list.length === 0) setAdding(true);
    } catch {
      setError("Could not load the ledger for this account.");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { void load(); }, [load]);

  const periodPrefix = scope === "year"
    ? String(period.year)
    : `${period.year}-${String(period.month + 1).padStart(2, "0")}`;
  const periodLabel = scope === "year" ? String(period.year) : `${MONTHS[period.month]} ${period.year}`;

  // Date strings are YYYY-MM-DD, so a prefix test is the whole filter and it
  // cannot drift into a timezone the way a parsed Date would.
  const scoped = useMemo(
    () => (scope === "all" ? entries : entries.filter((e) => e.date.startsWith(periodPrefix))),
    [entries, scope, periodPrefix],
  );

  const summary = useMemo(() => payoutSummary(scoped), [scoped]);
  const curve = useMemo(() => payoutCurve(scoped), [scoped]);
  const comparison = useMemo(
    () => costComparison(estimatedCostToPass, summary),
    [estimatedCostToPass, summary],
  );
  const rows = useMemo(
    () => [...scoped].sort((a, b) =>
      a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date),
    ),
    [scoped],
  );

  // An entry dated outside the month you are looking at would vanish the moment
  // it saves, so the form opens on the period instead of on today.
  const defaultDate = () => {
    const t = today();
    return scope === "all" || t.startsWith(periodPrefix) ? t : `${periodPrefix}-01`;
  };

  const openForm = () => {
    setDraft({ kind: "fee", date: defaultDate(), amount: plannedFee > 0 ? String(plannedFee) : "", label: tr(""), firm: null });
    setAdding(true);
  };

  const stepPeriod = (dir: 1 | -1) => setPeriod((p) => {
    if (scope === "year") return { ...p, year: p.year + dir };
    const month = p.month + dir;
    if (month < 0) return { year: p.year - 1, month: 11 };
    if (month > 11) return { year: p.year + 1, month: 0 };
    return { ...p, month };
  });

  // Switching scope snaps to the month of the most recent entry when the
  // current period is empty, the way the calendar snaps to the latest trade
  // instead of opening on a blank month.
  const chooseScope = (next: "month" | "year" | "all") => {
    if (next !== "all" && entries.length > 0) {
      const prefix = (y: number, m: number) =>
        next === "year" ? String(y) : `${y}-${String(m + 1).padStart(2, "0")}`;
      if (!entries.some((e) => e.date.startsWith(prefix(period.year, period.month)))) {
        const latest = entries.reduce((a, e) => (e.date > a ? e.date : a), entries[0].date);
        const [y, m] = latest.split("-").map(Number);
        if (!Number.isNaN(y) && !Number.isNaN(m)) setPeriod({ year: y, month: m - 1 });
      }
    }
    setScope(next);
  };

  const save = async () => {
    const amount = Number(draft.amount);
    if (!accountId || !Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/prop-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId, kind: draft.kind, date: draft.date, amount, label: draft.label,
          firm: (draft.firm ?? firm).trim(),
        }),
      });
      if (!res.ok) throw new Error("request failed");
      const saved = (await res.json()) as PropLedgerEntry;
      setEntries((prev) => [...prev, saved]);
      setError(null);
      setAdding(false);
    } catch {
      setError("Could not save that entry.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/prop-ledger", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("request failed");
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setError(null);
    } catch {
      setError("Could not delete that entry.");
    } finally {
      setBusyId(null);
    }
  };

  const total = summary.feesPaid + summary.payoutsReceived;
  const feeShare = total > 0 ? (summary.feesPaid / total) * 100 : 0;
  const recoveredColor = summary.recoveredPct === null
    ? "var(--text-muted)"
    : summary.recoveredPct >= 100 ? PAYOUT_COLOR
    : summary.recoveredPct >= 50 ? "var(--warning)"
    : FEE_COLOR;
  // Under the model is good news; over it is a cost warning, not a loss.
  const deltaColor = comparison && comparison.actual > 0
    ? comparison.difference < 0 ? PAYOUT_COLOR
      : comparison.difference > 0 ? "var(--warning)"
        : "var(--text-muted)"
    : "var(--text-muted)";

  return (
    <SectionCard
      title={tr("Payout tracker")}
        subtitle={`${firm ? `${firm} · ` : ""}Actual cash for this challenge: fees out, payouts in. The return-on-fee card above is an estimate — these are the receipts.`}
    >
      {!accountId ? (
        <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          {tr("Select an account to track its challenge fees and payouts.")}</p>
      ) : loading ? (
        <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{tr("Loading the ledger…")}</p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>{tr("Showing")}</span>
            <div style={{ display: "flex", gap: "2px", padding: "2px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "7px" }}>
              {(["month", "year", "all"] as const).map((s) => {
                const active = scope === s;
                return (
                  <button
                    key={s}
                    onClick={() => chooseScope(s)}
                    aria-pressed={active}
                    style={{
                      padding: "4px 8px", borderRadius: "5px", border: "none", cursor: "pointer",
                      fontSize: "11px", fontWeight: "600", fontFamily: "'DM Sans', sans-serif",
                      background: active ? "var(--accent-green-dim)" : "transparent",
                      color: active ? "var(--accent-green)" : "var(--text-muted)",
                    }}
                  >
                    {tr(s === "month" ? "Month" : s === "year" ? "Year" : "All")}
                  </button>
                );
              })}
            </div>

            {scope !== "all" && (
              <>
                <button onClick={() => stepPeriod(-1)} aria-label={tr(`Previous ${scope}`)} style={arrowButtonStyle}>
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", minWidth: "118px", textAlign: "center" }}>
                  {periodLabel}
                </span>
                <button onClick={() => stepPeriod(1)} aria-label={tr(`Next ${scope}`)} style={arrowButtonStyle}>
                  <ChevronRight size={14} />
                </button>
                <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--text-muted)" }}>
                  {scoped.length}  {tr("of")} {entries.length} {tr(entries.length === 1 ? "entry" : "entries")}
                </span>
              </>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
            <Tile
              label={tr("Fees paid")}
              value={money(summary.feesPaid)}
              color={FEE_COLOR}
              sub={tr(summary.feeCount > 0 ? plural(summary.feeCount, "fee") : "no fees recorded")}
            />
            <Tile
              label={tr("Payouts received")}
              value={money(summary.payoutsReceived)}
              color={PAYOUT_COLOR}
              sub={tr(summary.payoutCount > 0 ? plural(summary.payoutCount, "payout") : "nothing paid out yet")}
            />
            <Tile
              label={tr("Net")}
              value={money(summary.net)}
              color={summary.net > 0 ? PAYOUT_COLOR : summary.net < 0 ? FEE_COLOR : "var(--text-primary)"}
              sub={tr(summary.entries === 0
                ? "nothing recorded yet"
                : summary.net >= 0 ? "payouts cover the fees" : `${money(-summary.net)} still to recover`)}
            />
            <Tile
              label={tr("Fees recovered")}
              value={summary.recoveredPct === null ? "—" : pct1(summary.recoveredPct)}
              color={recoveredColor}
              sub={tr(summary.recoveredPct === null
                ? "no fees recorded"
                : `${money(summary.payoutsReceived)} of ${money(summary.feesPaid)}`)}
            />
          </div>

          {/* The model prices every attempt until funding, so the comparison
              only holds for the lifetime view. */}
          {comparison && scope === "all" && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 22px", marginTop: "14px", background: "var(--bg-secondary)", borderRadius: "10px", padding: "12px 16px" }}>
              <span style={labelStyle}>{tr("Model vs ledger")}</span>
              <Figure label={tr("Expected fees before funding")} value={money(comparison.estimated)} />
              <Figure label={tr("Fees actually paid")} value={money(comparison.actual)} color={FEE_COLOR} />
              <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: 700, color: deltaColor }}>
                {tr(comparison.actual === 0
                  ? "no fees logged yet"
                  : comparison.difference < 0
                    ? `${money(-comparison.difference)} under the estimate`
                    : comparison.difference > 0
                      ? `${money(comparison.difference)} over the estimate`
                      : "level with the estimate")}
              </span>
            </div>
          )}

          {summary.breakEvenPayouts != null && summary.avgPayout != null && (
            <p style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "10px 0 0", lineHeight: 1.6 }}>
              {plural(summary.breakEvenPayouts, "more payout")}  {tr("at your average")} {money(summary.avgPayout)} {tr("clears the fees.")}</p>
          )}
          {summary.feesPaid > 0 && summary.net >= 0 && (
            <p style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "10px 0 0", lineHeight: 1.6 }}>
              {tr("Fees are cleared —")}{money(summary.net)}  {tr("ahead after")} {plural(summary.feeCount, "fee")}  {tr("and")} {plural(summary.payoutCount, "payout")}.
            </p>
          )}

          {total > 0 && (
            <>
              <div style={{ display: "flex", height: "14px", borderRadius: "7px", overflow: "hidden", background: "var(--bg-secondary)", marginTop: "16px" }}>
                <div title={tr(`Fees paid ${money(summary.feesPaid)}`)} style={{ width: `${feeShare}%`, background: FEE_COLOR }} />
                <div title={tr(`Payouts received ${money(summary.payoutsReceived)}`)} style={{ width: `${100 - feeShare}%`, background: PAYOUT_COLOR }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 20px", marginTop: "10px" }}>
                <LegendChip color={FEE_COLOR} label={tr("Fees paid")} value={money(summary.feesPaid)} />
                <LegendChip color={PAYOUT_COLOR} label={tr("Payouts received")} value={money(summary.payoutsReceived)} />
              </div>
            </>
          )}

          {error && (
            <p style={{ fontSize: "12px", color: FEE_COLOR, margin: "12px 0 0" }}>{error}</p>
          )}

          {curve.length >= 2 && (
            <div style={{ marginTop: "22px" }}>
              <div style={{ ...labelStyle, marginBottom: "8px" }}>{tr("Cumulative fees vs payouts")}</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={curve} margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date" tick={axisStyle} axisLine={false} tickLine={false}
                    tickFormatter={(d) => String(d).slice(5)} minTickGap={18}
                  />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(x) => money0(Number(x))} width={62} />
                  <Tooltip content={LedgerTooltip} cursor={{ stroke: "var(--border)" }} />
                  <Line type="stepAfter" dataKey="fees" stroke={FEE_COLOR} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false} isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="payouts" stroke={PAYOUT_COLOR} strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
            <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{tr("Ledger")}</h4>
            <span style={{ fontSize: "11.5px", color: "var(--text-muted)", flex: 1 }}>
              {tr(summary.entries === 0
                ? scope === "all" ? "Nothing recorded yet" : `Nothing in ${periodLabel}`
                : `${summary.entries} ${summary.entries === 1 ? "entry" : "entries"} · ${scope === "all" ? "newest first" : periodLabel}`)}
            </span>
            {/* Hidden while the form is open: the form carries its own Cancel,
                and two buttons doing the same thing reads as a bug. */}
            {!adding && (
              <button onClick={openForm} style={linkButtonStyle}>
                {tr("Add entry")}<ChevronDown size={13} />
              </button>
            )}
          </div>

          {adding && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginTop: "16px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <span style={labelStyle}>{tr("Type")}</span>
                  <select
                    value={draft.kind}
                    onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as PayoutKind }))}
                    style={inputStyle}
                  >
                    <option value="fee">{tr("Fee paid")}</option>
                    <option value="payout">{tr("Payout")}</option>
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <span style={labelStyle}>{tr("Date")}</span>
                  <input
                    type="date" value={draft.date}
                    onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <span style={labelStyle}>{tr("Amount")}</span>
                  <input
                    type="number" min={0} step={10} value={draft.amount}
                    placeholder={tr(draft.kind === "fee" ? String(plannedFee) : "0")}
                    onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <span style={labelStyle}>{tr("Prop firm")}</span>
                  <input
                    type="text" value={draft.firm ?? firm} placeholder={tr("FTMO")}
                    onChange={(e) => setDraft((d) => ({ ...d, firm: e.target.value }))}
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <span style={labelStyle}>{tr("Label (optional)")}</span>
                  <input
                    type="text" value={draft.label}
                    placeholder={tr(draft.kind === "fee" ? "Phase 1" : "Payout #1")}
                    onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                    style={inputStyle}
                  />
                </label>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button onClick={save} disabled={saving} style={{ ...primaryButtonStyle, opacity: saving ? 0.6 : 1, cursor: saving ? "default" : "pointer" }}>
                  {tr(saving ? "Saving…" : "Save entry")}
                </button>
                <button onClick={() => setAdding(false)} style={secondaryButtonStyle}>{tr("Cancel")}</button>
              </div>
            </>
          )}

          {rows.length === 0 ? (
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "14px", lineHeight: 1.6 }}>
              {tr(scope === "all"
                ? "Record the fee when you pay it and each payout when it lands. The tiles above stay at zero until something is entered."
                : `Nothing was recorded in ${periodLabel}. The month and year views only count the entries dated inside them.`)}
            </p>
          ) : (
            <div style={{ marginTop: "12px" }}>
              {rows.map((e) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 2px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", flexShrink: 0, width: "76px" }}>
                    {e.date}
                  </span>
                  {/* Only a row from another firm is worth labelling: repeating
                      the account's own firm on every line is noise. */}
                  {e.firm && e.firm !== firm && (
                    <span
                      title={tr(`Paid against ${e.firm}`)}
                      style={{
                        fontSize: "10px", fontWeight: 700, color: "var(--accent-blue)",
                        background: "rgba(77,159,255,0.1)", border: "1px solid rgba(77,159,255,0.25)",
                        borderRadius: "5px", padding: "1px 6px", flexShrink: 0,
                      }}
                    >
                      {e.firm}
                    </span>
                  )}
                  <span style={{ flex: 1, minWidth: 0, fontSize: "12.5px", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.label || (e.kind === "fee" ? "Challenge fee" : "Payout")}
                  </span>
                  <KindChip kind={e.kind} />
                  <span style={{
                    fontSize: "13px", fontWeight: 700, fontVariantNumeric: "tabular-nums",
                    color: e.kind === "fee" ? FEE_COLOR : PAYOUT_COLOR,
                    flexShrink: 0, minWidth: "76px", textAlign: "right",
                  }}>
                    {money(e.amount)}
                  </span>
                  <button
                    onClick={() => void remove(e.id)}
                    disabled={busyId === e.id}
                    aria-label={tr(`Delete ${e.kind === "fee" ? "fee" : "payout"} from ${e.date}`)}
                    style={{
                      background: "none", border: "none", cursor: busyId === e.id ? "default" : "pointer",
                      padding: "2px", color: "var(--text-muted)", display: "flex", flexShrink: 0,
                      opacity: busyId === e.id ? 0.4 : 1,
                    }}
                    onMouseEnter={(ev) => { ev.currentTarget.style.color = FEE_COLOR; }}
                    onMouseLeave={(ev) => { ev.currentTarget.style.color = "var(--text-muted)"; }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.6, marginTop: "16px", marginBottom: 0 }}>
            {tr("These rows are money that moved: the fee you paid and the payouts you received. They are not netted against the return-on-fee estimate above, which prices a hypothetical attempt from the configured fee and the simulated pass rate.")}</p>
        </>
      )}
    </SectionCard>
  );
}
