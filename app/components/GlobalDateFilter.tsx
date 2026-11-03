"use client";
import { useMemo } from "react";
import { Calendar, X } from "lucide-react";
import { useApp } from "../context/AppContext";

// The one period + symbol control, mounted once in the shell above the page
// content. Because it renders outside the page components it survives tab
// switches, and because it writes to AppContext both pages read the same
// value instead of keeping private copies.
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Presets are built from local calendar dates, the same way the calendar and
// the filters read them; using UTC here would shift the window near midnight.
function rangePresets() {
  const now = new Date();
  const today = iso(now);
  const back = (days: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
    return iso(d);
  };
  return [
    { key: "7D",  from: back(6),  to: today },
    { key: "30D", from: back(29), to: today },
    { key: "MTD", from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today },
    { key: "YTD", from: iso(new Date(now.getFullYear(), 0, 1)), to: today },
  ];
}

export default function GlobalDateFilter() {
  const { dateRange, setDateRange, clearDateRange, symbolFilter, setSymbolFilter, trades } = useApp();
  const hasRange = Boolean(dateRange.from || dateRange.to);
  const presets = rangePresets();
  const activePreset = presets.find(
    (p) => p.from === dateRange.from && p.to === dateRange.to
  )?.key;

  // Only offer markets this account actually traded, otherwise the list fills
  // with symbols that can never produce a row. Analytics groups by underlying,
  // so the filter has to group the same way.
  const symbols = useMemo(() => {
    const seen = new Set<string>();
    for (const t of trades) {
      const key = t.underlying || t.symbol;
      if (key) seen.add(key);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [trades]);

  const hasFilters = hasRange || Boolean(symbolFilter);

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

      <div style={{
        display: "flex", gap: "2px", padding: "2px",
        background: "var(--bg-secondary)", border: "1px solid var(--border)",
        borderRadius: "7px",
      }}>
        {presets.map((p) => {
          const active = activePreset === p.key;
          return (
            <button
              key={p.key}
              onClick={() => setDateRange({ from: p.from, to: p.to })}
              aria-pressed={active}
              style={{
                padding: "4px 8px", borderRadius: "5px", border: "none",
                cursor: "pointer", fontSize: "11px", fontWeight: "600",
                fontFamily: "'DM Sans', sans-serif",
                background: active ? "var(--accent-green-dim)" : "transparent",
                color: active ? "var(--accent-green)" : "var(--text-muted)",
              }}
            >
              {p.key}
            </button>
          );
        })}
        <button
          onClick={clearDateRange}
          aria-pressed={!hasRange}
          style={{
            padding: "4px 8px", borderRadius: "5px", border: "none",
            cursor: "pointer", fontSize: "11px", fontWeight: "600",
            fontFamily: "'DM Sans', sans-serif",
            background: !hasRange ? "var(--accent-green-dim)" : "transparent",
            color: !hasRange ? "var(--accent-green)" : "var(--text-muted)",
          }}
        >
          All
        </button>
      </div>

      <input
        type="date" value={dateRange.from}
        onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
        style={inputStyle}
      />
      <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>to</span>
      <input
        type="date" value={dateRange.to}
        onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
        style={inputStyle}
      />

      <div style={{ width: "1px", height: "22px", background: "var(--border)", flexShrink: 0 }} />

      <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)" }}>Market</span>
      <select
        value={symbolFilter}
        onChange={(e) => setSymbolFilter(e.target.value)}
        style={{ ...inputStyle, minWidth: "140px", cursor: "pointer" }}
        aria-label="Filter analytics by market"
      >
        <option value="">All markets</option>
        {symbols.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={() => { clearDateRange(); setSymbolFilter(""); }}
          style={{
            display: "flex", alignItems: "center", gap: "4px",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--loss)", fontSize: "12px",
            fontFamily: "'DM Sans', sans-serif", fontWeight: "600",
          }}
        >
          <X size={12} /> Clear
        </button>
      )}
    </div>
  );
}
