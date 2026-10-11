"use client";
import { useState, useMemo } from "react";
import {
  Target, Timer, Percent, Ratio, Upload, Search, X,
  ChevronDown, ShieldCheck, ShieldAlert, Trash2,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { useSettings } from "../hooks/useSettings";
import { Trade } from "../lib/types";

// Daily Risk Controls Strip 
function DailyRiskStrip({ trades }: { trades: Trade[] }) {
  const { settings } = useSettings();
  const { dailyLossLimit, maxDailyTrades } = settings;

  const todayKey = new Date().toISOString().split("T")[0];

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
  const statusColor = anyBreached ? "#ff4d6a" : anyWarning ? "#fbbf24" : "#00e57a";

  return (
    <div style={{
      background: bgColor, border: `1px solid ${borderColor}`,
      borderRadius: "12px", padding: "14px 18px", marginBottom: "24px",
      display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <StatusIcon size={16} color={statusColor} />
        <span style={{ fontSize: "12px", fontWeight: "700", color: statusColor }}>
          {anyBreached ? "Limit Reached" : anyWarning ? "Approaching Limit" : "Within Limits"}
        </span>
      </div>

      <div style={{ width: "1px", height: "28px", background: "var(--border)", flexShrink: 0 }} />

      {dailyLossLimit > 0 && (
        <div style={{ flex: 1, minWidth: "180px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.3px" }}>
              DAILY LOSS
            </span>
            <span style={{
              fontSize: "11px", fontWeight: "700",
              color: lossBreached ? "#ff4d6a" : lossWarning ? "#fbbf24" : "var(--text-muted)",
            }}>
              ${Math.abs(todayLoss).toFixed(2)} / ${dailyLossLimit.toFixed(2)}
            </span>
          </div>
          <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${lossUsedPct}%`,
              background: lossBreached ? "#ff4d6a" : lossWarning ? "#fbbf24" : "#00e57a",
              borderRadius: "4px", transition: "width 0.3s ease",
            }} />
          </div>
        </div>
      )}

      {maxDailyTrades > 0 && (
        <div style={{ flex: 1, minWidth: "180px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "0.3px" }}>
              TRADES TODAY
            </span>
            <span style={{
              fontSize: "11px", fontWeight: "700",
              color: tradeBreached ? "#ff4d6a" : tradeWarning ? "#fbbf24" : "var(--text-muted)",
            }}>
              {todayCount} / {maxDailyTrades}
            </span>
          </div>
          <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${tradeUsedPct}%`,
              background: tradeBreached ? "#ff4d6a" : tradeWarning ? "#fbbf24" : "#00e57a",
              borderRadius: "4px", transition: "width 0.3s ease",
            }} />
          </div>
        </div>
      )}

      <div style={{ flexShrink: 0, textAlign: "right" }}>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "2px" }}>TODAY</div>
        <div style={{ fontSize: "16px", fontWeight: "800", color: todayPnl >= 0 ? "#00e57a" : "#ff4d6a" }}>
          {todayPnl >= 0 ? "+" : ""}${todayPnl.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

// Time helpers
// Entry/exit times are stored as a time of day ("9:32 AM", "14:05"), matching the
// formats extractHour() in app/api/trades/route.ts accepts on import.
function toDecimalHours(raw?: string): number | null {
  if (!raw) return null;
  const t = raw.trim();

  const ampm = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const period = ampm[3].toUpperCase();
    if (period === "AM" && h === 12) h = 0;
    if (period === "PM" && h !== 12) h += 12;
    return h + parseInt(ampm[2], 10) / 60;
  }

  const h24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    const h = parseInt(h24[1], 10);
    if (h <= 23) return h + parseInt(h24[2], 10) / 60;
  }

  return null;
}

// Hours a trade was held. MetaTrader exports the exact hold time, so prefer it;
// fall back to the time-of-day pair for older files, where a trade closing after
// midnight is treated as crossing over (22:10 -> 01:05 = 2.92h).
function tradeHours(trade: Trade): number | null {
  if (trade.durationMin != null && trade.durationMin > 0) return trade.durationMin / 60;

  const entry = toDecimalHours(trade.entryTime);
  const exit  = toDecimalHours(trade.exitTime);
  if (entry === null || exit === null) return null;
  const hours = exit - entry < 0 ? exit - entry + 24 : exit - entry;
  return hours > 0 ? hours : null;
}

// R:R is stored as free text (the trade panel hints "1:2.5"), and the MetaTrader
// exporter writes a plain multiple. Returns the reward multiple, or null when
// the trade has no readable ratio.
function parseRR(raw?: string): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[rR]/g, "");
  if (!cleaned) return null;

  const parts = cleaned.split(":");
  if (parts.length === 2) {
    const reward = parseFloat(parts[1]);
    const risk   = parseFloat(parts[0]);
    if (isNaN(reward) || isNaN(risk) || risk === 0) return null;
    return Math.abs(reward / risk);
  }

  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// Stat Cards 
function StatCard({ label, value, sub, positive, icon: Icon }: {
  label: string; value: string; sub: string; positive: boolean | null; icon: any;
}) {
  // null = no data yet, render neutral instead of picking a side
  const color = positive === null ? "var(--text-muted)" : positive ? "#00e57a" : "#ff4d6a";

  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "12px", padding: "20px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "500" }}>{label}</span>
        <Icon size={16} color={color} />
      </div>
      <div style={{
        fontSize: "24px", fontWeight: "700", fontFamily: "'Syne', sans-serif",
        color, marginBottom: "4px",
      }}>
        {value}
      </div>
      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{sub}</div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "8px 30px 8px 12px", borderRadius: "8px",
  border: "1px solid var(--border)", background: "var(--bg-card)",
  color: "#f0f0ff", fontSize: "12px", fontFamily: "'DM Sans', sans-serif",
  cursor: "pointer", appearance: "none", WebkitAppearance: "none", outline: "none",
};

function SelectWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "relative" }}>
      {children}
      <ChevronDown size={12} color="#8888aa" style={{
        position: "absolute", right: "10px", top: "50%",
        transform: "translateY(-50%)", pointerEvents: "none",
      }} />
    </div>
  );
}

export default function Dashboard() {
  const { trades, setActivePage, setSelectedTrade, deleteTrade, activeAccount } = useApp();

  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSymbol, setFilterSymbol] = useState("");
  const [filterTag, setFilterTag]       = useState("");
  const [filterFrom, setFilterFrom]     = useState("");
  const [filterTo, setFilterTo]         = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const symbols = useMemo(() => {
    const set = new Set(trades.map((t) => t.underlying));
    return Array.from(set).sort();
  }, [trades]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const t of trades) {
      const tags = Array.isArray(t.tags) ? t.tags : [];
      tags.forEach((tag: string) => set.add(tag));
    }
    return Array.from(set).sort();
  }, [trades]);

  const activeFilterCount = [
    search, filterStatus !== "all" ? filterStatus : "",
    filterSymbol, filterTag, filterFrom, filterTo,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch(""); setFilterStatus("all"); setFilterSymbol("");
    setFilterTag(""); setFilterFrom(""); setFilterTo("");
  };

  const filtered = useMemo(() => {
    return trades.filter((t) => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterSymbol && t.underlying !== filterSymbol) return false;
      if (filterTag && !(Array.isArray(t.tags) ? t.tags : []).includes(filterTag)) return false;
      if (filterFrom && new Date(t.date).getTime() < new Date(filterFrom).getTime()) return false;
      if (filterTo   && new Date(t.date).getTime() > new Date(filterTo).getTime())   return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.underlying.toLowerCase().includes(q) && !t.symbol.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [trades, search, filterStatus, filterSymbol, filterTag, filterFrom, filterTo]);

  const totalPnl     = filtered.reduce((sum, t) => sum + t.pnl, 0);
  const wins         = filtered.filter((t) => t.status === "win");
  const losses       = filtered.filter((t) => t.status === "loss");
  const winRate      = filtered.length > 0 ? Math.round((wins.length / filtered.length) * 100) : 0;

  // Return % — net result measured against the account's starting balance
  const baseBalance = activeAccount?.initialBalance ?? 0;
  const returnPct   = baseBalance > 0 ? (totalPnl / baseBalance) * 100 : null;

  // Hourly pay rate — net P&L divided by total time spent in trade
  const totalHours = filtered.reduce((sum, t) => sum + (tradeHours(t) ?? 0), 0);
  const hourlyRate = totalHours > 0 ? totalPnl / totalHours : null;

  // Average R:R across the trades that carry a ratio
  const rrValues = filtered
    .map((t) => parseRR(t.rr))
    .filter((v): v is number => v !== null);
  const avgRR = rrValues.length > 0 ? rrValues.reduce((s, v) => s + v, 0) / rrValues.length : null;

  const tradeCountLabel =
    `${filtered.length} trade${filtered.length !== 1 ? "s" : ""}${activeFilterCount > 0 ? " (filtered)" : ""}`;

  const stats = [
    {
      label: activeFilterCount > 0 ? "Filtered Return" : "Return %",
      value: returnPct === null ? "—" : `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(2)}%`,
      sub:   returnPct === null
        ? "Set an initial balance to track returns"
        : `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)} · ${tradeCountLabel}`,
      positive: returnPct === null ? null : returnPct >= 0,
      icon: Percent,
    },
    {
      label: "$/Hour",
      value: hourlyRate === null ? "—" : `${hourlyRate >= 0 ? "+" : ""}$${hourlyRate.toFixed(2)}`,
      sub:   hourlyRate === null
        ? "Needs entry and exit times"
        : `per hour over ${formatHours(totalHours)}`,
      positive: hourlyRate === null ? null : hourlyRate >= 0,
      icon: Timer,
    },
    {
      label: "Avg R:R",
      value: avgRR === null ? "—" : `${avgRR >= 0 ? "+" : ""}${avgRR.toFixed(2)}R`,
      sub:   avgRR === null
        ? "Add R:R to a trade to include it"
        : `${rrValues.length} of ${filtered.length} trade${filtered.length !== 1 ? "s" : ""} rated`,
      positive: avgRR === null ? null : avgRR >= 1,
      icon: Ratio,
    },
    { label: "Win Rate",      value: `${winRate}%`,  sub: `${wins.length}W / ${losses.length}L`, positive: winRate >= 50, icon: Target },
  ];

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    await deleteTrade(id);
    setConfirmDeleteId(null);
  };

  return (
    <>
      <div style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "26px", fontWeight: "700", color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
          Dashboard
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
          Welcome back. Here's how you're performing.
        </p>
      </div>

      {/* Daily risk strip — only renders when limits are configured */}
      <DailyRiskStrip trades={trades} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

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
            No trades yet
          </h3>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "24px" }}>
            Run the Journedge exporter on your MetaTrader terminal, then import the CSV to get started.
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
              Import CSV
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "16px", overflow: "hidden",
        }}>
          <div style={{ padding: "20px 24px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: "16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)" }}>
                  Trade History
                </h3>
                {activeFilterCount > 0 && (
                  <span style={{
                    background: "var(--accent-green-dim)", color: "var(--accent-green)",
                    fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "20px",
                  }}>
                    {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
                  </span>
                )}
                {filtered.length !== trades.length && (
                  <span style={{ fontSize: "12px", color: "#8888aa" }}>
                    Showing {filtered.length} of {trades.length}
                  </span>
                )}
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  style={{
                    display: "flex", alignItems: "center", gap: "4px",
                    background: "none", border: "none", cursor: "pointer",
                    color: "#ff4d6a", fontSize: "12px",
                    fontFamily: "'DM Sans', sans-serif", fontWeight: "600",
                  }}
                >
                  <X size={12} /> Clear filters
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", paddingBottom: "16px" }}>
              <div style={{ position: "relative", flex: "1", minWidth: "160px" }}>
                <Search size={13} color="#8888aa" style={{
                  position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)",
                }} />
                <input
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search symbol..."
                  style={{
                    width: "100%", padding: "8px 12px 8px 30px", borderRadius: "8px",
                    border: "1px solid var(--border)", background: "var(--bg-secondary)",
                    color: "#f0f0ff", fontSize: "12px", fontFamily: "'DM Sans', sans-serif",
                    boxSizing: "border-box" as const, outline: "none",
                  }}
                />
              </div>

              <SelectWrap>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
                  <option value="all">All Status</option>
                  <option value="win">Wins</option>
                  <option value="loss">Losses</option>
                  <option value="breakeven">Breakeven</option>
                </select>
              </SelectWrap>

              {symbols.length > 0 && (
                <SelectWrap>
                  <select value={filterSymbol} onChange={(e) => setFilterSymbol(e.target.value)} style={selectStyle}>
                    <option value="">All Symbols</option>
                    {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </SelectWrap>
              )}

              {allTags.length > 0 && (
                <SelectWrap>
                  <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} style={selectStyle}>
                    <option value="">All Tags</option>
                    {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                </SelectWrap>
              )}

              <input
                type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
                style={{ ...selectStyle, padding: "8px 12px", colorScheme: "dark" }}
              />
              <input
                type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
                style={{ ...selectStyle, padding: "8px 12px", colorScheme: "dark" }}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#8888aa", fontSize: "14px" }}>
              No trades match your filters.{" "}
              <button onClick={clearFilters} style={{
                background: "none", border: "none", color: "var(--accent-green)",
                cursor: "pointer", fontSize: "14px", fontFamily: "'DM Sans', sans-serif",
              }}>
                Clear filters
              </button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                    {["Date", "Symbol", "Type", "Strike", "Expiry", "Qty", "Entry", "Exit", "P&L", "Status", ""].map((h) => (
                      <th key={h} style={{
                        padding: "10px 16px", textAlign: "left",
                        color: "var(--text-muted)", fontWeight: "600", whiteSpace: "nowrap",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((trade: Trade) => (
                    <tr
                      key={trade.id}
                      onClick={() => setSelectedTrade(trade)}
                      style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        if (confirmDeleteId === trade.id) setConfirmDeleteId(null);
                      }}
                    >
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{trade.date}</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-primary)", fontWeight: "700" }}>{trade.underlying}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "600",
                          background: trade.optionType === "call" ? "rgba(77,159,255,0.15)" : "rgba(255,77,106,0.15)",
                          color: trade.optionType === "call" ? "#4d9fff" : "#ff4d6a",
                        }}>
                          {trade.optionType ? trade.optionType.toUpperCase() : trade.type.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{trade.strike ? `$${trade.strike}` : "—"}</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{trade.expiry || "—"}</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{trade.quantity}</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>${trade.entryPrice}</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>${trade.exitPrice}</td>
                      <td style={{ padding: "12px 16px", fontWeight: "700", color: trade.pnl >= 0 ? "#00e57a" : "#ff4d6a" }}>
                        {trade.pnl >= 0 ? "+" : ""}${trade.pnl}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "600",
                          background: trade.status === "win"
                            ? "rgba(0,229,122,0.12)"
                            : trade.status === "loss"
                            ? "rgba(255,77,106,0.12)"
                            : "rgba(136,136,170,0.12)",
                          color: trade.status === "win" ? "#00e57a" : trade.status === "loss" ? "#ff4d6a" : "#8888aa",
                        }}>
                          {trade.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", width: "48px" }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(trade.id); }}
                          title={confirmDeleteId === trade.id ? "Click again to confirm" : "Delete trade"}
                          style={{
                            background: confirmDeleteId === trade.id ? "rgba(255,77,106,0.15)" : "transparent",
                            border: `1px solid ${confirmDeleteId === trade.id ? "#ff4d6a" : "transparent"}`,
                            borderRadius: "6px", padding: "5px 7px", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            if (confirmDeleteId !== trade.id) {
                              e.currentTarget.style.background = "rgba(255,77,106,0.1)";
                              e.currentTarget.style.borderColor = "rgba(255,77,106,0.4)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (confirmDeleteId !== trade.id) {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.borderColor = "transparent";
                            }
                          }}
                        >
                          <Trash2 size={13} color={confirmDeleteId === trade.id ? "#ff4d6a" : "#8888aa"} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
